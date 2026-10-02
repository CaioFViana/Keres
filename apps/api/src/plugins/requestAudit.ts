import { Elysia } from 'elysia';
import { classifyRequest, isAdminApiPath, outcomeOf } from '../audit/requestAuditRules';
import type { JWTPayload } from '../index';
import { type AuditInput, auditService } from '../services/AuditService';
import { trackBackground } from '../utils/backgroundWork';

/** What the audit needs of a finished request. */
export interface FinishedRequest {
  method: string;
  path: string;
  status: number;
  user: JWTPayload | null;
  body: unknown;
  ip: string | null;
  userAgent: string | null;
  /** The reason a refusal gave, when it gave one. */
  error?: string;
}

export interface AuditDecision {
  input: AuditInput;
  /** The actor is named only by the body (a login): the account behind that name is looked up. */
  lookupUsername?: string;
}

const MAX_ERROR = 200;

const bodyUsername = (body: unknown): string | null => {
  const value = (body as { username?: unknown } | null)?.username;
  return typeof value === 'string' && value ? value : null;
};

/**
 * Decides what - if anything - a finished request is in the activity record. Pure: the plugin below feeds
 * it and writes what comes out; the tests feed it directly.
 *
 * Never reads the body beyond the name of whoever is logging in or signing up, and never the query: a
 * password, a token or the text of a message does not get this far.
 */
export function decideAudit(request: FinishedRequest): AuditDecision | null {
  const { method, path, status, user } = request;
  const { rule, groups } = classifyRequest(method, path);
  const failedMeta = (extra: Record<string, unknown> = {}) => ({
    status,
    ...(request.error ? { reason: request.error.slice(0, MAX_ERROR) } : {}),
    ...extra,
  });
  const base = {
    actorUserId: user?.userId ?? null,
    actorUsername: user?.username ?? null,
    ip: request.ip,
    userAgent: request.userAgent,
  };

  // Somebody who is not an administrator at the administrators' door: always worth a line, whatever it asked.
  if (isAdminApiPath(path) && (status === 401 || status === 403)) {
    return {
      input: {
        ...base,
        category: 'security',
        action: 'security.admin_access_denied',
        outcome: 'denied',
        meta: failedMeta({ method, path }),
      },
    };
  }

  if (status === 429) {
    const route = rule?.action ?? `${method} ${path.replace(/\/[0-9A-Z]{26}(?=\/|$)/g, '/:id')}`;
    return {
      input: {
        ...base,
        // On a route that has a plan limit, a 429 is that limit being met rather than rate limiting.
        category: rule?.limitRoute ? 'limits' : 'security',
        action: rule?.limitRoute ? 'limits.exceeded' : 'security.rate_limited',
        outcome: 'denied',
        subjectUserId: groups[rule?.subjectGroup ?? ''] ?? null,
        meta: failedMeta({ route }),
      },
    };
  }

  if (!rule) {
    // An administrative change no rule knows yet is still recorded: the trail must not have holes.
    if (isAdminApiPath(path) && method !== 'GET') {
      return {
        input: {
          ...base,
          category: 'admin',
          action: 'admin.request',
          outcome: outcomeOf(status),
          meta: failedMeta({ method, path }),
        },
      };
    }
    return null;
  }

  const outcome = outcomeOf(status);
  if (rule.onlyFailures && outcome === 'success') return null;

  const typedName = rule.usernameFromBody ? bodyUsername(request.body) : null;
  const input: AuditInput = {
    ...base,
    actorUsername: base.actorUsername ?? typedName,
    category: rule.category,
    action: rule.action,
    outcome,
    subjectUserId: rule.subjectGroup ? (groups[rule.subjectGroup] ?? null) : null,
    targetType: rule.targetType ?? null,
    targetId: rule.targetGroup ? (groups[rule.targetGroup] ?? null) : null,
    meta: outcome === 'success' ? { status } : failedMeta(),
  };
  return {
    input,
    lookupUsername: !input.actorUserId && typedName ? typedName : undefined,
  };
}

/** Private and loopback addresses: where a reverse proxy sits, so the real client is in `X-Forwarded-For`. */
const PROXY_ADDRESS =
  /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|::ffff:(127\.|10\.|192\.168\.))/i;

/** The address of whoever made the request, looking through a reverse proxy sitting on this machine's network. */
export function clientAddress(remote: string | null, forwardedFor: string | null): string | null {
  if (remote && PROXY_ADDRESS.test(remote) && forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first && first.length <= 45 && /^[0-9a-f:.]+$/i.test(first)) return first;
  }
  return remote;
}

/** Reasons the error handler saw, until the request finishes and the audit reads them. */
const reasons = new WeakMap<Request, string>();
/** Who each request came from, noted when it arrives: the server is not handed to the hooks that run after it. */
const addresses = new WeakMap<Request, string | null>();

/**
 * The request audit, as an Elysia plugin: remembers why a request was refused, and when it is over turns
 * it into a line of the activity record if a rule says it is worth one. It sits after the session is
 * derived (it needs to know who asked) and before the routes, so it sees all of them.
 */
export const requestAudit = new Elysia({ name: 'request-audit' })
  .onRequest(({ request, server }) => {
    addresses.set(
      request,
      clientAddress(
        server?.requestIP(request)?.address ?? null,
        request.headers.get('x-forwarded-for'),
      ),
    );
  })
  .onError({ as: 'global' }, ({ request, error }) => {
    if (error instanceof Error) reasons.set(request, error.message);
  })
  .onAfterResponse({ as: 'global' }, (context) => {
    const { request, set, path } = context;
    const user = (context as unknown as { user?: JWTPayload | null }).user ?? null;
    const body = (context as unknown as { body?: unknown }).body;
    const status = typeof set.status === 'number' ? set.status : Number(set.status) || 200;
    const decision = decideAudit({
      method: request.method,
      path,
      status,
      user,
      body,
      ip: addresses.get(request) ?? null,
      userAgent: request.headers.get('user-agent'),
      error: reasons.get(request),
    });
    if (!decision) return;
    trackBackground(
      (async () => {
        try {
          const { input, lookupUsername } = decision;
          if (lookupUsername) {
            input.actorUserId = await auditService.findUserIdByUsername(lookupUsername);
          }
          await auditService.recordNow(input);
        } catch (error) {
          console.error('Failed to record an audit event', error);
        }
      })(),
    );
  });
