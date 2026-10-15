import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { UserFormPage } from '@/pages/users/UserFormPage';
import { UsersListPage } from '@/pages/users/UsersListPage';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { changeInput, click, flush, render, submit } from '@test/helpers/react';

/**
 * The age-verification part of the user pages: the account's standing and the verification actions. In `manual`
 * mode an administrator marks an unverified account by hand and can revoke it; in `required` only the service
 * verifies, so the administrator can only revoke. The save never sends a verification flag.
 */

const mocks = vi.hoisted(() => ({
  listUsers: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  listTiers: vi.fn(),
  userSubscription: vi.fn(),
  getRegistrationSettings: vi.fn(),
}));

vi.mock('@/api/RegistrationSettingsApiService', () => ({
  RegistrationSettingsApiService: { get: mocks.getRegistrationSettings },
}));

vi.mock('@/api/AdminUserApiService', () => ({
  AdminUserApiService: {
    list: mocks.listUsers,
    get: mocks.getUser,
    create: vi.fn(),
    update: mocks.updateUser,
    softDelete: vi.fn(),
    restore: vi.fn(),
    regenerateRecoveryCodes: vi.fn(),
  },
}));
vi.mock('@/api/PaymentsApiService', () => ({
  PaymentsApiService: { userSubscription: mocks.userSubscription, giveGift: vi.fn() },
}));
vi.mock('@/api/TierApiService', () => ({
  TierApiService: { list: mocks.listTiers },
}));

const verified = {
  isAdultVerified: true,
  verificationStatus: 'active',
  verifiedAt: '2026-09-01T10:00:00.000Z',
  verificationMethod: 'manual-document-live-photo',
};
const unverified = {
  isAdultVerified: false,
  verificationStatus: 'active',
  verifiedAt: null,
  verificationMethod: null,
};

const user = (over: Record<string, unknown> = {}) => ({
  id: 'user-1',
  username: 'ana',
  tag: 'ana',
  isAdmin: false,
  tierId: null,
  bio: null,
  isDeleted: false,
  createdAt: '2026-08-19T10:00:00.000Z',
  ...unverified,
  ...over,
});

function renderFormAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <Routes>
          <Route path="/users/new" element={<UserFormPage />} />
          <Route path="/users/:id" element={<UserFormPage />} />
          <Route path="/users" element={<p>users list</p>} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

function renderList() {
  return render(
    <MemoryRouter initialEntries={['/users']}>
      <ThemeProvider>
        <Routes>
          <Route path="/users" element={<UsersListPage />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

/** The edit dialog is the only `.modal` in these tests; its form is the one to submit. */
const dialog = (container: HTMLDivElement) => container.querySelector('.modal') as HTMLElement;
const dialogForm = (container: HTMLDivElement) => dialog(container).querySelector('form')!;
const dialogButton = (container: HTMLDivElement, text: string) =>
  Array.from(dialog(container).querySelectorAll('button')).find(
    (entry) => entry.textContent === text,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listUsers.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });
  mocks.listTiers.mockResolvedValue([]);
  mocks.userSubscription.mockResolvedValue({ subscription: null, canCancelAtProvider: false });
  mocks.getUser.mockResolvedValue(user());
  mocks.updateUser.mockResolvedValue({});
  mocks.getRegistrationSettings.mockResolvedValue({ ageVerificationMode: 'required' });
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a verified account in the edit dialog', () => {
  it('says it is verified with its method and date, and offers revoking', async () => {
    mocks.getUser.mockResolvedValue(user(verified));
    const view = await renderFormAt('/users/user-1');
    await flush();

    const state = view.container.querySelector('[data-testid="verification-state"]')?.textContent;
    expect(state).toContain('Verified 18+ (manual-document-live-photo, ');
    expect(dialogButton(view.container, 'Revoke verification')).toBeDefined();
    expect(dialogButton(view.container, 'Mark as verified +18')).toBeUndefined();
    await view.unmount();
  });

  it('revokes only after the operator confirms, and sends exactly the revocation', async () => {
    mocks.getUser.mockResolvedValue(user(verified));
    const view = await renderFormAt('/users/user-1');
    await flush();

    vi.mocked(confirm).mockReturnValueOnce(false);
    await click(dialogButton(view.container, 'Revoke verification')!);
    await flush();
    expect(mocks.updateUser).not.toHaveBeenCalled();

    await click(dialogButton(view.container, 'Revoke verification')!);
    await flush();
    expect(confirm).toHaveBeenLastCalledWith(expect.stringContaining('ana'));
    expect(mocks.updateUser).toHaveBeenCalledTimes(1);
    expect(mocks.updateUser).toHaveBeenCalledWith('user-1', { isAdultVerified: false });

    // Once revoked the account reads as not verified, and there is nothing left to revoke.
    expect(view.container.querySelector('[data-testid="verification-state"]')?.textContent).toBe(
      'Not verified',
    );
    expect(dialogButton(view.container, 'Revoke verification')).toBeUndefined();
    await view.unmount();
  });

  it('keeps the account verified and says why when the revocation fails', async () => {
    mocks.getUser.mockResolvedValue(user(verified));
    mocks.updateUser.mockRejectedValue(new Error('server down'));
    const view = await renderFormAt('/users/user-1');
    await flush();

    await click(dialogButton(view.container, 'Revoke verification')!);
    await flush();

    expect(view.container.querySelector('.error-text')?.textContent).toBe('server down');
    expect(dialogButton(view.container, 'Revoke verification')).toBeDefined();
    await view.unmount();
  });

  it('keeps the save from sending a verification flag at all', async () => {
    mocks.getUser.mockResolvedValue(user(verified));
    const view = await renderFormAt('/users/user-1');
    await flush();

    await submit(dialogForm(view.container));
    await flush();

    expect(mocks.updateUser).toHaveBeenCalledTimes(1);
    expect(mocks.updateUser.mock.calls[0][1]).not.toHaveProperty('isAdultVerified');
    await view.unmount();
  });
});

describe('an account that is not verified in required mode', () => {
  it('says so, with no checkbox and no way to verify it by hand', async () => {
    const view = await renderFormAt('/users/user-1');
    await flush();

    expect(view.container.querySelector('[data-testid="verification-state"]')?.textContent).toBe(
      'Not verified',
    );
    // The admin-access checkbox stays; no checkbox may be about verification.
    const labels = Array.from(dialog(view.container).querySelectorAll('label')).map(
      (label) => label.textContent ?? '',
    );
    expect(labels.filter((text) => /verif|\+18/i.test(text))).toEqual([]);
    expect(dialogButton(view.container, 'Revoke verification')).toBeUndefined();
    expect(dialogButton(view.container, 'Mark as verified +18')).toBeUndefined();
    await view.unmount();
  });

  it('explains that only the service verifies, and that an administrator can only revoke', async () => {
    const view = await renderFormAt('/users/user-1');
    await flush();

    expect(view.container.querySelector('[data-testid="verification-source"]')?.textContent).toBe(
      'Verified by the age-verification service: an administrator can only revoke a verification, not mark one.',
    );
    await view.unmount();
  });

  it('never sends `isAdultVerified: true` on save, whatever the operator edits', async () => {
    const view = await renderFormAt('/users/user-1');
    await flush();

    await changeInput(dialogForm(view.container).querySelector('input')!, 'ana-2');
    await submit(dialogForm(view.container));
    await flush();

    expect(mocks.updateUser).toHaveBeenCalledTimes(1);
    expect(mocks.updateUser.mock.calls[0][1]).not.toHaveProperty('isAdultVerified');
    await view.unmount();
  });

  it('shows the pending badge while the service has not decided', async () => {
    mocks.getUser.mockResolvedValue(user({ verificationStatus: 'pending' }));
    const view = await renderFormAt('/users/user-1');
    await flush();

    const badge = dialog(view.container).querySelector('.status-badge');
    expect(badge?.textContent).toBe('Pending verification');
    expect(view.container.querySelector('[data-testid="verification-state"]')?.textContent).toBe(
      'Not verified',
    );
    await view.unmount();
  });

  it('shows the refused badge when the person was turned down', async () => {
    mocks.getUser.mockResolvedValue(user({ verificationStatus: 'rejected' }));
    const view = await renderFormAt('/users/user-1');
    await flush();

    expect(dialog(view.container).querySelector('.status-badge')?.textContent).toBe(
      'Verification refused',
    );
    await view.unmount();
  });
});

describe('an account that is not verified in manual mode', () => {
  beforeEach(() => {
    mocks.getRegistrationSettings.mockResolvedValue({ ageVerificationMode: 'manual' });
  });

  it('offers marking it verified, and says how the mark is made and removed', async () => {
    const view = await renderFormAt('/users/user-1');
    await flush();

    expect(dialogButton(view.container, 'Mark as verified +18')).toBeDefined();
    expect(dialogButton(view.container, 'Revoke verification')).toBeUndefined();
    expect(view.container.querySelector('[data-testid="verification-source"]')?.textContent).toBe(
      'Accounts start unverified. Verify the person by other means, then mark the account here; you can remove the mark at any time.',
    );
    await view.unmount();
  });

  it('confirms, sends exactly the grant, and then shows the account as verified by hand', async () => {
    const view = await renderFormAt('/users/user-1');
    await flush();

    vi.mocked(confirm).mockReturnValueOnce(false);
    await click(dialogButton(view.container, 'Mark as verified +18')!);
    await flush();
    expect(mocks.updateUser).not.toHaveBeenCalled();

    await click(dialogButton(view.container, 'Mark as verified +18')!);
    await flush();
    expect(confirm).toHaveBeenLastCalledWith(expect.stringContaining('ana'));
    expect(mocks.updateUser).toHaveBeenCalledTimes(1);
    expect(mocks.updateUser).toHaveBeenCalledWith('user-1', { isAdultVerified: true });

    const state = view.container.querySelector('[data-testid="verification-state"]')?.textContent;
    expect(state).toMatch(/^Verified 18\+ \(manual, /);
    expect(dialogButton(view.container, 'Mark as verified +18')).toBeUndefined();
    expect(dialogButton(view.container, 'Revoke verification')).toBeDefined();
    await view.unmount();
  });

  it('shows the reason and keeps the account unverified when the grant fails', async () => {
    mocks.updateUser.mockRejectedValue(new Error('server down'));
    const view = await renderFormAt('/users/user-1');
    await flush();

    await click(dialogButton(view.container, 'Mark as verified +18')!);
    await flush();

    expect(view.container.querySelector('.error-text')?.textContent).toBe('server down');
    expect(view.container.querySelector('[data-testid="verification-state"]')?.textContent).toBe(
      'Not verified',
    );
    expect(dialogButton(view.container, 'Mark as verified +18')).toBeDefined();
    await view.unmount();
  });

  it('does not offer the grant to an account that is already verified', async () => {
    mocks.getUser.mockResolvedValue(user(verified));
    const view = await renderFormAt('/users/user-1');
    await flush();

    expect(dialogButton(view.container, 'Mark as verified +18')).toBeUndefined();
    expect(dialogButton(view.container, 'Revoke verification')).toBeDefined();
    await view.unmount();
  });

  it('offers no grant while the mode cannot be read', async () => {
    mocks.getRegistrationSettings.mockRejectedValue(new Error('offline'));
    const view = await renderFormAt('/users/user-1');
    await flush();

    expect(view.container.querySelector('[data-testid="verification-state"]')?.textContent).toBe(
      'Not verified',
    );
    expect(dialogButton(view.container, 'Mark as verified +18')).toBeUndefined();
    expect(view.container.querySelector('[data-testid="verification-source"]')).toBeNull();
    await view.unmount();
  });
});

describe('edges of the verification actions', () => {
  it('offers no grant when the server does not state its mode', async () => {
    mocks.getRegistrationSettings.mockResolvedValue({});
    const view = await renderFormAt('/users/user-1');
    await flush();

    expect(dialogButton(view.container, 'Mark as verified +18')).toBeUndefined();
    expect(view.container.querySelector('[data-testid="verification-source"]')).toBeNull();
    await view.unmount();
  });

  it('falls back to a plain message when a grant or a revocation fails without a reason', async () => {
    mocks.getRegistrationSettings.mockResolvedValue({ ageVerificationMode: 'manual' });
    mocks.updateUser.mockRejectedValue('nope');
    const view = await renderFormAt('/users/user-1');
    await flush();

    await click(dialogButton(view.container, 'Mark as verified +18')!);
    await flush();
    const grantError = view.container.querySelector('.error-text')?.textContent;
    expect(grantError).toBeTruthy();
    expect(grantError).not.toBe('nope');
    await view.unmount();

    mocks.getUser.mockResolvedValue(user(verified));
    const again = await renderFormAt('/users/user-1');
    await flush();
    await click(dialogButton(again.container, 'Revoke verification')!);
    await flush();
    const revokeError = again.container.querySelector('.error-text')?.textContent;
    expect(revokeError).toBeTruthy();
    expect(revokeError).not.toBe('nope');
    await again.unmount();
  });

  it('states a verification with a date but no method, or with neither', async () => {
    mocks.getUser.mockResolvedValue(user({ ...verified, verificationMethod: null }));
    const dated = await renderFormAt('/users/user-1');
    await flush();
    const datedState = dated.container.querySelector(
      '[data-testid="verification-state"]',
    )?.textContent;
    expect(datedState).toMatch(/^Verified 18\+ /);
    expect(datedState).not.toContain('(manual');
    await dated.unmount();

    mocks.getUser.mockResolvedValue(
      user({ ...verified, verifiedAt: null, verificationMethod: null }),
    );
    const bare = await renderFormAt('/users/user-1');
    await flush();
    expect(bare.container.querySelector('[data-testid="verification-state"]')?.textContent).toMatch(
      /^Verified 18\+/,
    );
    await bare.unmount();
  });
});

describe('loading the edit dialog', () => {
  it('shows why the account could not be read', async () => {
    mocks.getUser.mockRejectedValue(new Error('not found'));
    const view = await renderFormAt('/users/user-1');
    await flush();

    expect(view.container.querySelector('.error-text')?.textContent).toBe('not found');
    await view.unmount();
  });

  it('shows why the tiers could not be read, with or without a reason', async () => {
    mocks.listTiers.mockRejectedValue(new Error('tiers down'));
    const withReason = await renderFormAt('/users/user-1');
    await flush();
    expect(withReason.container.textContent).toContain('tiers down');
    await withReason.unmount();

    mocks.listTiers.mockRejectedValue('nope');
    const without = await renderFormAt('/users/user-1');
    await flush();
    expect(without.container.querySelector('.error-text')).not.toBeNull();
    await without.unmount();
  });

  it('names the tier an account uses, or its id when the tier is not listed', async () => {
    mocks.listTiers.mockResolvedValue([{ id: 'tier-1', name: 'Gold' }]);
    mocks.getUser.mockResolvedValue(
      user({ tierSource: 'subscription', effectiveTierId: 'tier-1', tierId: 'tier-1' }),
    );
    const listed = await renderFormAt('/users/user-1');
    await flush();
    expect(listed.container.textContent).toContain('Gold');
    await listed.unmount();

    mocks.getUser.mockResolvedValue(user({ tierSource: 'default', effectiveTierId: 'tier-9' }));
    const unlisted = await renderFormAt('/users/user-1');
    await flush();
    expect(unlisted.container.textContent).toContain('tier-9');
    await unlisted.unmount();

    mocks.getUser.mockResolvedValue(user({ tierSource: 'default', effectiveTierId: null }));
    const none = await renderFormAt('/users/user-1');
    await flush();
    expect(none.container.querySelector('[data-testid="tier-in-use"]')).not.toBeNull();
    await none.unmount();
  });

  it('ignores answers that arrive after the dialog was closed', async () => {
    let answerUser: (value: unknown) => void = () => undefined;
    let answerSettings: (value: unknown) => void = () => undefined;
    let failUser: (reason: Error) => void = () => undefined;
    mocks.getUser.mockReturnValueOnce(new Promise((resolve) => (answerUser = resolve)));
    mocks.getRegistrationSettings.mockReturnValueOnce(
      new Promise((resolve) => (answerSettings = resolve)),
    );
    const first = await renderFormAt('/users/user-1');
    await first.unmount();
    answerUser(user());
    answerSettings({ ageVerificationMode: 'manual' });

    mocks.getUser.mockReturnValueOnce(new Promise((_, reject) => (failUser = reject)));
    mocks.getRegistrationSettings.mockRejectedValueOnce(new Error('late'));
    const second = await renderFormAt('/users/user-1');
    await second.unmount();
    failUser(new Error('late'));
    await flush();

    expect(mocks.getUser).toHaveBeenCalledTimes(2);
  });

  it('sends the tag with the save when the account has one', async () => {
    const view = await renderFormAt('/users/user-1');
    await flush();

    await submit(dialogForm(view.container));
    await flush();

    expect(mocks.updateUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ tag: 'ana' }),
    );
    await view.unmount();
  });
});

describe('the user list', () => {
  it('shows the pending and refused standing of accounts that are not verified', async () => {
    mocks.listUsers.mockResolvedValue({
      items: [
        user({ id: 'a', username: 'pedro', verificationStatus: 'pending' }),
        user({ id: 'b', username: 'rita', verificationStatus: 'rejected' }),
      ],
      total: 2,
      page: 1,
      pageSize: 25,
    });
    const view = await renderList();
    await flush();

    expect(view.container.querySelector('[data-testid="standing-pending"]')?.textContent).toBe(
      'Pending verification',
    );
    expect(view.container.querySelector('[data-testid="standing-rejected"]')?.textContent).toBe(
      'Verification refused',
    );
    await view.unmount();
  });

  it('keeps the +18 badge for verified accounts, and the adults-only filter', async () => {
    mocks.listUsers.mockResolvedValue({
      items: [user({ id: 'c', username: 'lia', ...verified })],
      total: 1,
      page: 1,
      pageSize: 25,
    });
    const view = await renderList();
    await flush();

    expect(view.container.querySelector('tbody .status-badge')?.textContent).toBe('+18');
    expect(view.container.querySelector('[data-testid="standing-pending"]')).toBeNull();

    const filter = Array.from(view.container.querySelectorAll('label'))
      .find((label) => label.textContent?.includes('Verified +18 only'))!
      .querySelector('input')!;
    await click(filter);
    await flush();
    expect(mocks.listUsers).toHaveBeenLastCalledWith(
      expect.objectContaining({ adultVerified: true }),
    );
    await view.unmount();
  });
});
