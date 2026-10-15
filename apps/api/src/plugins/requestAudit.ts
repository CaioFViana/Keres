import { Elysia } from 'elysia';
import { classifyRequest, isAdminApiPath, outcomeOf } from '@/audit/requestAuditRules';
import type { JWTPayload } from '@/index';
import { type AuditInput, auditService } from '@/services/AuditService';
import { trackBackground } from '@/utils/backgroundWork';
import { QUESTION_CODES } from '@/utils/errors';

/** What the audit needs of a finished request. */
export interface FinishedRequest {
  method: string;
  path: string;
  status: number;
  user: JWTPayload | null;
  body: unknown;
  /** The query string, as parsed by the server: only the keys a rule names are ever read from it. */
  query?: unknown;
  /** The reason a refusal gave, when it gave one. */
  error?: string;
  /** The code a refusal carried, when it carried one (see `QUESTION_CODES`). */
  errorCode?: string;
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
 * The query keys a rule names, as the filters it was asked with. Only the keys the rule lists are read: a
 * search text, an address or anything else that is not a filter of the record never gets into the line.
 */
const filtersOf = (query: unknown, keys: readonly string[]): Record<string, string> => {
  const picked: Record<string, string> = {};
  for (const key of keys) {
    const value = (query as Record<string, unknown> | null | undefined)?.[key];
    if (typeof value === 'string' && value) picked[key] = value.slice(0, MAX_ERROR);
  }
  return picked;
};

/**
 * Decides what - if anything - a finished request is in the activity record. Pure: the plugin below feeds
 * it and writes what comes out; the tests feed it directly.
 *
 * Never reads the body beyond the name of whoever is logging in or signing up, and never the query beyond the
 * filters a rule names: a password, a token or the text of a message does not get this far. The address of a
 * request is not here at all - it lives in the access records (see `AccessRecordService`).
 */
export function decideAudit(request: FinishedRequest): AuditDecision | null {
  const { method, path, status, user } = request;
  // A question put to the person is a step of a flow, not something that went wrong.
  if (request.errorCode && QUESTION_CODES.has(request.errorCode)) return null;
  const { rule, groups } = classifyRequest(method, path);
  const failedMeta = (extra: Record<string, unknown> = {}) => ({
    status,
    ...(request.error ? { reason: request.error.slice(0, MAX_ERROR) } : {}),
    ...extra,
  });
  const base = {
    actorUserId: user?.userId ?? null,
    actorUsername: user?.username ?? null,
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
  // Whoever the body names is who signs in (or up), not an account whose session the browser still carries.
  const typedActor = typedName ? { actorUserId: null, actorUsername: typedName } : {};
  // Looking at the record is itself on the record: which filters were used, never what they found.
  const filters = rule.queryKeys ? { filters: filtersOf(request.query, rule.queryKeys) } : {};
  const input: AuditInput = {
    ...base,
    ...typedActor,
    category: rule.category,
    action: rule.action,
    outcome,
    subjectUserId: rule.subjectGroup ? (groups[rule.subjectGroup] ?? null) : null,
    targetType: rule.targetType ?? null,
    targetId: rule.targetGroup ? (groups[rule.targetGroup] ?? null) : null,
    meta: outcome === 'success' ? { status, ...filters } : failedMeta(filters),
  };
  return {
    input,
    lookupUsername: !input.actorUserId && typedName ? typedName : undefined,
  };
}

/** Private and loopback addresses: where a reverse proxy sits, so the real client is in `X-Forwarded-For`. */
const PROXY_ADDRESS =
  /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|::ffff:(127\.|10\.|192\.168\.))/i;
/** What an address in the header may look like: hex digits, colons and dots, nothing a client could use to inject text. */
const ADDRESS_SHAPE = /^[0-9a-f:.]{1,45}$/i;

/**
 * The address of whoever made the request. Behind a reverse proxy on this machine's network (a private address)
 * the real client is in `X-Forwarded-For`: the proxy appends the address it received the request from, so the
 * entries on the right were written by the proxy, and the ones on the left by the client, who may write anything.
 * The rightmost address that is not a private hop is the client; what the client put before it is ignored.
 */
export function clientAddress(remote: string | null, forwardedFor: string | null): string | null {
  if (remote && PROXY_ADDRESS.test(remote) && forwardedFor) {
    const hops = forwardedFor
      .split(',')
      .map((hop) => hop.trim())
      .filter((hop) => ADDRESS_SHAPE.test(hop));
    // A client on the same private network as the proxy is the last hop itself: take it when every hop is private.
    const client = [...hops].reverse().find((hop) => !PROXY_ADDRESS.test(hop)) ?? hops.at(-1);
    if (client) return client;
  }
  return remote;
}

/** The address a request came from, as the access records and the sign-in routes see it. */
export function requestAddress(
  request: Request,
  server: { requestIP(request: Request): { address: string } | null } | null | undefined,
): string | null {
  return clientAddress(
    server?.requestIP(request)?.address ?? null,
    request.headers.get('x-forwarded-for'),
  );
}

/** Reasons the error handler saw, until the request finishes and the audit reads them. */
const reasons = new WeakMap<Request, string>();
/** The code a refusal carried, by request. */
const codes = new WeakMap<Request, string>();

/**
 * The request audit, as an Elysia plugin: remembers why a request was refused, and when it is over turns
 * it into a line of the activity record if a rule says it is worth one. It sits after the session is
 * derived (it needs to know who asked) and before the routes, so it sees all of them.
 */
export const requestAudit = new Elysia({ name: 'request-audit' })
  .onError({ as: 'global' }, ({ request, error }) => {
    if (error instanceof Error) reasons.set(request, error.message);
    const code = (error as { code?: unknown } | null)?.code;
    if (typeof code === 'string') codes.set(request, code);
  })
  .onAfterResponse({ as: 'global' }, (context) => {
    const { request, set, path } = context;
    // Only the API is audited. The rules are written without the `/api` prefix, so a page of the admin panel or of the
    // app that shares a path with a route (`/admin/access-records`) would otherwise count as that route being used.
    if (!path.startsWith('/api/')) return;
    const user = (context as unknown as { user?: JWTPayload | null }).user ?? null;
    const body = (context as unknown as { body?: unknown }).body;
    const query = (context as unknown as { query?: unknown }).query;
    const status = typeof set.status === 'number' ? set.status : Number(set.status) || 200;
    const decision = decideAudit({
      method: request.method,
      path,
      status,
      user,
      body,
      query,
      error: reasons.get(request),
      errorCode: codes.get(request),
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
