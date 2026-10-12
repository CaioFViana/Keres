import { beforeEach, describe, expect, it } from 'vitest';
import { PRIVACY_POLICY_VERSION } from '../../src/legal/privacyPolicy';
import { SERVER_TERMS_VERSION } from '../../src/legal/serverTerms';
import { auditService } from '../../src/services/AuditService';
import { contactService } from '../../src/services/ContactService';
import { UserService } from '../../src/services/UserService';
import { registerUser, request } from '../helpers/app';
import { truncateAll } from '../helpers/database';

beforeEach(truncateAll);

describe('account prune legal carve-outs', () => {
  it('keeps the terms-acceptance proof after the account is erased', async () => {
    const ana = await registerUser('ana');
    const service = new UserService();

    const deleted = await request('DELETE', '/user/account', {
      token: ana.token,
      body: { currentPassword: ana.password },
    });
    expect(deleted.status).toBe(200);
    expect(await service.pruneDeletedAccounts(0)).toBe(1);

    // The proof survives the erasure: who accepted which version when.
    const { status, data } = await request('GET', '/auth/terms-status', { token: ana.token });
    expect(status).toBe(200);
    expect(data.tos.accepted).toBe(SERVER_TERMS_VERSION);
    expect(data.privacy.accepted).toBe(PRIVACY_POLICY_VERSION);
  });

  it('scrubs the erased account out of the activity record but keeps the lines', async () => {
    const ana = await registerUser('ana');
    const service = new UserService();
    await auditService.recordNow({
      category: 'auth',
      action: 'auth.login',
      outcome: 'success',
      actorUserId: ana.userId,
      actorUsername: ana.username,
      ip: '203.0.113.7',
      userAgent: 'test-agent',
    });

    await request('DELETE', '/user/account', {
      token: ana.token,
      body: { currentPassword: ana.password },
    });
    expect(await service.pruneDeletedAccounts(0)).toBe(1);

    const page = await auditService.list({
      category: 'all',
      outcome: 'all',
      order: 'desc',
      page: 1,
      pageSize: 50,
    });
    expect(page.total).toBeGreaterThan(0);
    for (const event of page.items) {
      expect(event.actor?.id).not.toBe(ana.userId);
      expect(event.subject?.id).not.toBe(ana.userId);
      expect(event.ip).not.toBe('203.0.113.7');
      expect(event.userAgent).not.toBe('test-agent');
    }
  });
});

describe('contact message retention', () => {
  const visitor = {
    subject: 'Plans',
    body: 'Do you offer yearly billing?',
    contactEmail: 'visitor@example.com',
  };

  it('drops landing-page messages past the retention', async () => {
    const created = await request('POST', '/public/contact', { body: visitor });
    expect(created.status).toBe(201);

    expect(await contactService.pruneSiteMessages(new Date(), 0)).toBe(1);
    expect(await contactService.pruneSiteMessages(new Date(), 0)).toBe(0);
  });

  it('keeps recent messages', async () => {
    const created = await request('POST', '/public/contact', { body: visitor });
    expect(created.status).toBe(201);

    expect(await contactService.pruneSiteMessages(new Date(), 90)).toBe(0);
  });
});
