import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { env } from '@/config/env';
import { db } from '@/db';
import { ageVerificationEvents, ageVerifications } from '@/db/schema';
import { resetAgeVerifier } from '@/services/ageVerification/AgeVerifierRegistry';
import { newId, registerUser } from '@test/helpers/app';
import {
  approvedEvent,
  commitmentFor,
  enterRequiredMode,
  expiredEvent,
  leaveRequiredMode,
  pendingAccount,
  rejectedEvent,
  userRow,
} from '@test/helpers/ageVerificationAccounts';
import {
  postVerifierEvents,
  sendVerifierEvents,
  signVerifierEvents,
} from '@test/helpers/ageVerificationEvents';
import { truncateAll } from '@test/helpers/database';

beforeEach(async () => {
  await truncateAll();
});

afterEach(() => {
  leaveRequiredMode();
});

const rowOf = (id: string) =>
  db.query.ageVerifications.findFirst({ where: eq(ageVerifications.id, id) });

describe('POST /api/age-verification/events: proof of the sender', () => {
  it('refuses a message signed with a key that is not the events key, and changes nothing', async () => {
    enterRequiredMode();
    const { row, user } = await pendingAccount('ana');
    const event = approvedEvent(row);

    const answer = await postVerifierEvents([event], { forged: true });

    expect(answer.status).toBe(401);
    expect(answer.data).toEqual({ message: 'Request rejected.' });
    expect((await rowOf(row.id))?.status).toBe('pending');
    expect((await userRow(user.userId))?.isAdultVerified).toBe(false);
  });

  it('refuses a payments signature: the scheme tag keeps the two services apart', async () => {
    enterRequiredMode();
    const { row } = await pendingAccount('ana');
    const signed = signVerifierEvents([approvedEvent(row)], { direction: 'keres-to-verifier' });

    expect((await sendVerifierEvents(signed)).status).toBe(401);
  });

  it('refuses the same signed request a second time (a replay)', async () => {
    enterRequiredMode();
    const { row } = await pendingAccount('ana');
    const signed = signVerifierEvents([approvedEvent(row)]);

    expect((await sendVerifierEvents(signed)).status).toBe(200);
    expect((await sendVerifierEvents(signed)).status).toBe(401);
  });

  it('refuses a body changed after it was signed', async () => {
    enterRequiredMode();
    const { row } = await pendingAccount('ana');
    const signed = signVerifierEvents([approvedEvent(row)], {
      signedBody: JSON.stringify({ events: [] }),
    });

    expect((await sendVerifierEvents(signed)).status).toBe(401);
  });

  it('answers 404 while no service is connected to receive the events', async () => {
    enterRequiredMode();
    const { row } = await pendingAccount('ana');
    resetAgeVerifier();

    const answer = await postVerifierEvents([approvedEvent(row)]);

    expect(answer.status).toBe(404);
    expect((await rowOf(row.id))?.status).toBe('pending');
  });

  it('refuses a proven body that is not the contract, with 400', async () => {
    enterRequiredMode();
    const bad = await postVerifierEvents([{ type: 'verification.approved', eventId: 'x' }]);
    const notJson = await postVerifierEvents([], { rawBody: 'not json' });

    expect(bad.status).toBe(400);
    expect(notJson.status).toBe(400);
  });
});

describe('POST /api/age-verification/events: applying the facts', () => {
  it('an approval makes the account active and verified, with its method and date', async () => {
    enterRequiredMode();
    const { row, user } = await pendingAccount('ana');
    const event = approvedEvent(row);

    const answer = await postVerifierEvents([event]);

    expect(answer.status).toBe(200);
    expect(answer.data.outcomes).toEqual([{ eventId: event.eventId, outcome: 'applied' }]);
    const account = await userRow(user.userId);
    expect(account).toMatchObject({
      verificationStatus: 'active',
      isAdultVerified: true,
      verificationMethod: 'manual-document-live-photo',
    });
    expect(account?.verifiedAt).toBeInstanceOf(Date);
    const sending = await rowOf(row.id);
    expect(sending).toMatchObject({
      status: 'approved',
      method: 'manual-document-live-photo',
      identityCommitment: commitmentFor(row.id),
      rejectionReason: null,
      actionJson: null,
    });
    expect(sending?.discardedAt).toBeInstanceOf(Date);
  });

  it('applies the same event once: its second arrival is a duplicate and changes nothing', async () => {
    enterRequiredMode();
    const { row, user } = await pendingAccount('ana');
    const eventId = `evt_${newId()}`;

    const first = await postVerifierEvents([approvedEvent(row, { eventId })]);
    // The same eventId, now claiming a refusal: a retry of the service's outbox is the same fact, not a new one.
    const second = await postVerifierEvents([rejectedEvent(row, 'other', { eventId })]);

    expect(first.data.outcomes).toEqual([{ eventId, outcome: 'applied' }]);
    expect(second.data.outcomes).toEqual([{ eventId, outcome: 'duplicate' }]);
    expect((await rowOf(row.id))?.status).toBe('approved');
    expect((await userRow(user.userId))?.isAdultVerified).toBe(true);
    const ledger = await db
      .select()
      .from(ageVerificationEvents)
      .where(eq(ageVerificationEvents.eventId, eventId));
    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.outcome).toBe('applied');
  });

  it('records an event about an unknown verification as unknown, and ignores it', async () => {
    enterRequiredMode();
    const { user } = await pendingAccount('ana');
    const event = approvedEvent({ id: `ghost_${newId()}`, providerReference: 'nobody' });

    const answer = await postVerifierEvents([event]);

    expect(answer.data.outcomes).toEqual([{ eventId: event.eventId, outcome: 'unknown' }]);
    expect((await userRow(user.userId))?.isAdultVerified).toBe(false);
    const ledger = await db
      .select()
      .from(ageVerificationEvents)
      .where(eq(ageVerificationEvents.eventId, event.eventId as string));
    expect(ledger[0]?.outcome).toBe('unknown');
  });

  it('treats an event that names another provider reference than the sending has as unknown', async () => {
    enterRequiredMode();
    const { row, user } = await pendingAccount('ana');

    const answer = await postVerifierEvents([
      approvedEvent({ id: row.id, providerReference: 'some_other_reference' }),
    ]);

    expect(answer.data.outcomes[0].outcome).toBe('unknown');
    expect((await userRow(user.userId))?.isAdultVerified).toBe(false);
  });

  it('ignores an approval for a sending that was cancelled', async () => {
    enterRequiredMode();
    const { row, user } = await pendingAccount('ana');
    await db
      .update(ageVerifications)
      .set({ status: 'canceled' })
      .where(eq(ageVerifications.id, row.id));
    const event = approvedEvent(row);

    const answer = await postVerifierEvents([event]);

    expect(answer.data.outcomes).toEqual([{ eventId: event.eventId, outcome: 'ignored' }]);
    expect((await rowOf(row.id))?.status).toBe('canceled');
    expect((await userRow(user.userId))?.isAdultVerified).toBe(false);
  });

  it('ignores an approval while verification is manual, whatever the service says', async () => {
    enterRequiredMode();
    const { row, user } = await pendingAccount('ana');
    // The service is still connected, but the server is in manual mode: its events are not read in this mode.
    env.AGE_VERIFICATION_MODE = 'manual';

    const answer = await postVerifierEvents([approvedEvent(row)]);

    expect(answer.data.outcomes[0].outcome).toBe('ignored');
    expect((await userRow(user.userId))?.isAdultVerified).toBe(false);
  });

  it('refuses a request carrying more events than one may, and applies none of them', async () => {
    enterRequiredMode();
    const { row } = await pendingAccount('ana');
    const tooMany = Array.from({ length: 101 }, () => approvedEvent(row));

    const answer = await postVerifierEvents(tooMany);

    expect(answer.status).toBe(400);
    expect((await rowOf(row.id))?.status).toBe('pending');
  });
});

describe('the standing an event leaves the account in', () => {
  it('a refusal for another reason makes the account rejected and keeps it open', async () => {
    enterRequiredMode();
    const { row, user } = await pendingAccount('ana');

    const answer = await postVerifierEvents([rejectedEvent(row, 'face_mismatch')]);

    expect(answer.data.outcomes[0].outcome).toBe('applied');
    expect(await rowOf(row.id)).toMatchObject({
      status: 'rejected',
      rejectionReason: 'face_mismatch',
      identityCommitment: null,
    });
    const account = await userRow(user.userId);
    expect(account).toMatchObject({ verificationStatus: 'rejected', isDeleted: false });
    expect(account?.isAdultVerified).toBe(false);
  });

  it('an expiry makes the account rejected, so it can send again', async () => {
    enterRequiredMode();
    const { row, user } = await pendingAccount('ana');

    await postVerifierEvents([expiredEvent(row)]);

    expect((await rowOf(row.id))?.status).toBe('expired');
    expect((await userRow(user.userId))?.verificationStatus).toBe('rejected');
  });

  it('an underage refusal closes the account at once, and keeps the reason on the sending', async () => {
    enterRequiredMode();
    const { row, user } = await pendingAccount('ana');

    await postVerifierEvents([rejectedEvent(row, 'underage')]);

    const account = await userRow(user.userId);
    expect(account).toMatchObject({ verificationStatus: 'rejected', isDeleted: true });
    expect(account?.deletedAt).toBeInstanceOf(Date);
    expect((await rowOf(row.id))?.rejectionReason).toBe('underage');
  });
});

describe('an event is about one account only', () => {
  it('leaves a second, unrelated account pending', async () => {
    enterRequiredMode();
    const ana = await pendingAccount('ana');
    const bia = await pendingAccount('bia');

    await postVerifierEvents([approvedEvent(ana.row)]);

    expect((await userRow(bia.user.userId))?.verificationStatus).toBe('pending');
    expect((await userRow(bia.user.userId))?.isAdultVerified).toBe(false);
  });
});

// Registration in B1 is unchanged: a fresh account is active until B2 wires the gate in.
describe('an ordinary account before the registration change', () => {
  it('is not pending and not verified after registration', async () => {
    const ana = await registerUser('ana');

    expect(await userRow(ana.userId)).toMatchObject({
      verificationStatus: 'active',
      isAdultVerified: false,
    });
  });
});
