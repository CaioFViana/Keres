import { describe, expect, it } from 'vitest';
import {
  AUDIT_RULES,
  classifyRequest,
  isAdminApiPath,
  outcomeOf,
} from '../../src/audit/requestAuditRules';
import { clientAddress, decideAudit, type FinishedRequest } from '../../src/plugins/requestAudit';
import { csvCell } from '../../src/services/AuditService';

const ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const finished = (over: Partial<FinishedRequest> = {}): FinishedRequest => ({
  method: 'GET',
  path: '/api/anything',
  status: 200,
  user: null,
  body: undefined,
  ip: '203.0.113.9',
  userAgent: 'test-agent',
  ...over,
});
const ana = { userId: 'user-ana', username: 'ana' };

describe('classifyRequest', () => {
  it('finds the rule of a route, with the ids its path names', () => {
    expect(classifyRequest('POST', `/api/friend/request/${ULID}`)).toMatchObject({
      rule: { action: 'friend.request_sent' },
      groups: { targetUserId: ULID },
    });
    expect(classifyRequest('DELETE', `/api/story-permissions/story/s1/user/u2`)).toMatchObject({
      rule: { action: 'story.collaborator_removed' },
      groups: { storyId: 's1', targetUserId: 'u2' },
    });
  });

  it('is not fooled by a route a wider rule would also match', () => {
    expect(classifyRequest('DELETE', '/api/messages/admin').rule?.action).toBe(
      'message.conversation_cleared',
    );
    expect(classifyRequest('DELETE', '/api/messages/m1').rule?.action).toBe('message.deleted');
    expect(classifyRequest('GET', '/api/admin/messages/unread-count').rule).toBeNull();
    expect(classifyRequest('GET', '/api/admin/messages/m1').rule?.action).toBe(
      'admin.message_opened',
    );
  });

  it('knows nothing of routes that are not worth a line', () => {
    expect(classifyRequest('GET', '/api/friend/').rule).toBeNull();
    expect(classifyRequest('POST', '/api/sync/story-1').rule).toBeNull();
    expect(classifyRequest('PUT', '/api/friend/request/u1').rule).toBeNull();
  });

  it('gives every rule an area.what action in its own category', () => {
    for (const rule of AUDIT_RULES) {
      expect(rule.action).toMatch(/^[a-z]+\.[a-z_]+$/);
    }
  });
});

describe('payments', () => {
  it('records the person starting to pay, with what happened to it', () => {
    expect(classifyRequest('POST', '/api/payments/checkout').rule?.action).toBe(
      'payment.checkout_started',
    );
    const refused = decideAudit(
      finished({ method: 'POST', path: '/payments/checkout', status: 400, user: ana }),
    );
    expect(refused?.input).toMatchObject({
      category: 'payment',
      action: 'payment.checkout_started',
      outcome: 'failure',
      actorUserId: 'user-ana',
    });
  });

  it('records a notice of the provider only when it was refused, and never what it said', () => {
    expect(
      decideAudit(finished({ method: 'POST', path: '/payments/webhook', status: 200 })),
    ).toBeNull();
    const refused = decideAudit(
      finished({
        method: 'POST',
        path: '/payments/webhook',
        status: 400,
        body: '{"card":"4111111111111111"}',
      }),
    );
    expect(refused?.input).toMatchObject({
      category: 'payment',
      action: 'payment.webhook_rejected',
      outcome: 'failure',
    });
    expect(JSON.stringify(refused)).not.toContain('4111');
  });

  it('leaves reads of the plan out of the record', () => {
    expect(classifyRequest('GET', '/api/payments').rule).toBeNull();
    expect(classifyRequest('GET', '/api/payments/checkout/c1').rule).toBeNull();
  });
});

describe('outcomeOf', () => {
  it('tells a refusal for who asked or how often from one for what was asked', () => {
    expect(outcomeOf(200)).toBe('success');
    expect(outcomeOf(201)).toBe('success');
    expect(outcomeOf(403)).toBe('denied');
    expect(outcomeOf(429)).toBe('denied');
    expect(outcomeOf(401)).toBe('failure');
    expect(outcomeOf(404)).toBe('failure');
    expect(outcomeOf(500)).toBe('failure');
  });
});

describe('isAdminApiPath', () => {
  it("is the administrators' API and nothing that merely starts like it", () => {
    expect(isAdminApiPath('/api/admin')).toBe(true);
    expect(isAdminApiPath('/api/admin/users')).toBe(true);
    expect(isAdminApiPath('/api/administrators')).toBe(false);
    expect(isAdminApiPath('/admin/users')).toBe(false);
  });
});

describe('decideAudit', () => {
  it('records a login by the name that was typed, never the password', () => {
    const decision = decideAudit(
      finished({
        method: 'POST',
        path: '/api/auth/login',
        status: 401,
        body: { username: 'ana', password: 'hunter2' },
        error: 'Invalid credentials',
      }),
    );

    expect(decision?.lookupUsername).toBe('ana');
    expect(decision?.input).toMatchObject({
      category: 'auth',
      action: 'auth.login',
      outcome: 'failure',
      actorUsername: 'ana',
      ip: '203.0.113.9',
      meta: { status: 401, reason: 'Invalid credentials' },
    });
    expect(JSON.stringify(decision)).not.toContain('hunter2');
  });

  it('takes the actor from the session when there is one, and asks for no lookup', () => {
    const decision = decideAudit(
      finished({ method: 'PUT', path: '/api/user/password', user: ana, body: { password: 'x' } }),
    );

    expect(decision?.lookupUsername).toBeUndefined();
    expect(decision?.input).toMatchObject({
      action: 'account.password_changed',
      actorUserId: 'user-ana',
      actorUsername: 'ana',
      outcome: 'success',
      meta: { status: 200 },
    });
  });

  it('names who an action was done to', () => {
    const decision = decideAudit(
      finished({ method: 'POST', path: `/api/messages/user/${ULID}`, status: 201, user: ana }),
    );

    expect(decision?.input).toMatchObject({
      action: 'message.sent_direct',
      subjectUserId: ULID,
      targetType: 'user',
      targetId: ULID,
    });
  });

  it('records only the failures of the routes that say so', () => {
    const refresh = (status: number) =>
      decideAudit(finished({ method: 'POST', path: '/api/auth/refresh', status }));

    expect(refresh(200)).toBeNull();
    expect(refresh(401)?.input).toMatchObject({ action: 'auth.token_refresh', outcome: 'failure' });
  });

  it('counts a 429 on a route with a plan limit as that limit, and elsewhere as rate limiting', () => {
    const limited = decideAudit(
      finished({
        method: 'POST',
        path: '/api/messages/admin',
        status: 429,
        user: ana,
        error: 'You can send 30 messages a day to the administrators.',
      }),
    );
    expect(limited?.input).toMatchObject({
      category: 'limits',
      action: 'limits.exceeded',
      outcome: 'denied',
      meta: { route: 'message.sent_admin' },
    });

    const flooded = decideAudit(
      finished({ method: 'POST', path: '/api/public/contact', status: 429 }),
    );
    expect(flooded?.input).toMatchObject({
      category: 'security',
      action: 'security.rate_limited',
      outcome: 'denied',
      meta: { route: 'contact.message_received' },
    });
  });

  it('turns ids into :id when an unknown route is rate limited, so one route is one thing', () => {
    const decision = decideAudit(
      finished({ method: 'GET', path: `/api/stories/${ULID}/something`, status: 429 }),
    );

    expect(decision?.input.meta).toMatchObject({ route: 'GET /api/stories/:id/something' });
  });

  it("records somebody refused at the administrators' door, whatever they asked", () => {
    for (const status of [401, 403]) {
      const decision = decideAudit(
        finished({ method: 'GET', path: '/api/admin/users', status, user: ana }),
      );
      expect(decision?.input).toMatchObject({
        category: 'security',
        action: 'security.admin_access_denied',
        outcome: 'denied',
        actorUserId: 'user-ana',
        meta: { status, method: 'GET', path: '/api/admin/users' },
      });
    }
  });

  it('records an administrative change no rule knows yet, so the trail has no holes', () => {
    const decision = decideAudit(
      finished({ method: 'POST', path: '/api/admin/brand-new', user: ana }),
    );

    expect(decision?.input).toMatchObject({
      category: 'admin',
      action: 'admin.request',
      meta: { status: 200, method: 'POST', path: '/api/admin/brand-new' },
    });
  });

  it('leaves out what is not worth a line: reads, the sync, unknown routes', () => {
    expect(decideAudit(finished({ method: 'GET', path: '/api/admin/users' }))).toBeNull();
    expect(decideAudit(finished({ method: 'POST', path: '/api/sync/story-1' }))).toBeNull();
    expect(decideAudit(finished({ method: 'GET', path: '/api/friend/' }))).toBeNull();
  });

  it('keeps a long reason short', () => {
    const decision = decideAudit(
      finished({
        method: 'POST',
        path: '/api/auth/login',
        status: 401,
        body: { username: 'ana' },
        error: 'x'.repeat(5000),
      }),
    );

    expect((decision?.input.meta?.reason as string).length).toBe(200);
  });
});

describe('clientAddress', () => {
  it('is the address the connection came from', () => {
    expect(clientAddress('203.0.113.9', null)).toBe('203.0.113.9');
    expect(clientAddress('203.0.113.9', '198.51.100.1')).toBe('203.0.113.9');
    expect(clientAddress(null, null)).toBeNull();
  });

  it('looks through a reverse proxy on a private address, and trusts nothing else in the header', () => {
    expect(clientAddress('127.0.0.1', '198.51.100.1, 10.0.0.2')).toBe('198.51.100.1');
    expect(clientAddress('192.168.1.5', '2001:db8::1')).toBe('2001:db8::1');
    expect(clientAddress('10.0.0.2', 'not an address <script>')).toBe('10.0.0.2');
    expect(clientAddress('127.0.0.1', null)).toBe('127.0.0.1');
  });
});

describe('csvCell', () => {
  it('quotes what needs it', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
  });

  it('makes a formula text, so opening an export never runs what somebody typed', () => {
    for (const value of ['=1+1', '+SUM(A1)', '-2', '@cmd']) {
      expect(csvCell(value).startsWith("'")).toBe(true);
    }
  });
});
