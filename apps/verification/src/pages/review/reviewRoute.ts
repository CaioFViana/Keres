import { sha256Hex } from '../../protocol/signing';
import type { PageRoute, ServiceState } from '../../routes';
import {
  bareResponse,
  htmlResponse,
  type Lang,
  newNonce,
  sameOriginOrAbsent,
  seeOther,
} from '../http';
import { pageLanguage } from '../language';
import { REVIEW_MESSAGES } from '../reviewMessages';
import { readForm, textField } from './form';
import { approveAction, claimAction, itemPage, rejectAction } from './itemActions';
import { loginPage, loginSubmit } from './login';
import { heldBy, waitingQueue } from './queries';
import { imageResponse } from './reviewImages';
import { messagePage, queueHtml } from './reviewView';
import {
  csrfMatches,
  currentSession,
  REVIEW_PATH,
  type ReviewSession,
  sessionCookie,
} from './session';

/**
 * The reviewer's pages under `/review`: sign-in and out, the queue, one item, and the four actions on an item. Every
 * page but sign-in needs an open session; every state-changing post needs the session's CSRF token. The route table is
 * here and nowhere else, so the rules of who may reach what can be read in one place.
 */

const ID = '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})';
const ITEM = new RegExp(`^${REVIEW_PATH}/items/${ID}$`);
const ACTION = new RegExp(`^${REVIEW_PATH}/items/${ID}/(claim|approve|reject)$`);
const DOCUMENT = new RegExp(`^${REVIEW_PATH}/items/${ID}/doc/([12])$`);
const PHOTO = new RegExp(`^${REVIEW_PATH}/items/${ID}/photo$`);

const LOGIN = `${REVIEW_PATH}/login`;
const LOGOUT = `${REVIEW_PATH}/logout`;

const langOf = (request: Request): Lang =>
  pageLanguage(undefined, request.headers.get('accept-language'));

export const reviewRoute: PageRoute = async (request, url, state) => {
  const path = url.pathname;
  if (path !== REVIEW_PATH && !path.startsWith(`${REVIEW_PATH}/`)) return undefined;
  const method = request.method;
  const now = state.clock();

  if (path === LOGIN) {
    if (method === 'GET') return loginPage(request, url.searchParams.get('flash'));
    if (method === 'POST') return loginSubmit(request, state);
    return undefined;
  }

  const session = currentSession(state, request, now);
  const document = DOCUMENT.exec(path);
  if (document && method === 'GET') {
    return imageResponse(state, session, document[1] ?? '', {
      role: document[2] === '1' ? 'document-front' : 'document-back',
      action: 'view-document',
    });
  }
  const photo = PHOTO.exec(path);
  if (photo && method === 'GET') {
    return imageResponse(state, session, photo[1] ?? '', { role: 'photo', action: 'view-photo' });
  }

  // Everything else is for a reviewer with an open session; without one, the way is the sign-in page.
  if (!session) return seeOther(LOGIN);

  if (path === LOGOUT && method === 'POST') {
    return afterCsrf(request, state, session, () => endSession(state, session));
  }
  if ((path === REVIEW_PATH || path === `${REVIEW_PATH}/`) && method === 'GET') {
    return queuePage(request, state, session, url.searchParams.get('flash'));
  }
  const item = ITEM.exec(path);
  if (item && method === 'GET') return itemPage(request, state, session, item[1] ?? '');

  const action = ACTION.exec(path);
  if (action && method === 'POST') {
    const id = action[1] ?? '';
    const verb = action[2];
    if (verb === 'claim')
      return afterCsrf(request, state, session, () => claimAction(state, session, id));
    if (verb === 'approve') {
      return afterCsrf(request, state, session, (form) =>
        approveAction(request, state, session, id, form),
      );
    }
    if (verb === 'reject') {
      return afterCsrf(request, state, session, (form) =>
        rejectAction(request, state, session, id, form),
      );
    }
  }
  return undefined;
};

function queuePage(
  request: Request,
  state: ServiceState,
  session: ReviewSession,
  flash: string | null,
): Response {
  const nonce = newNonce();
  const now = state.clock();
  const html = queueHtml({
    lang: langOf(request),
    nonce,
    csrf: session.csrf,
    queue: waitingQueue(state, now),
    held: heldBy(state, session.reviewer.id, now),
    flash,
  });
  return htmlResponse(200, html, nonce);
}

/**
 * The checks every state-changing post shares, in order: the post comes from this service's own pages, its form reads,
 * and its CSRF token is the session's. A post that fails one of them changes nothing. The action gets the form (empty
 * for a claim or a sign-out, where none is needed).
 */
async function afterCsrf(
  request: Request,
  state: ServiceState,
  session: ReviewSession,
  action: (form: FormData) => Response | Promise<Response>,
): Promise<Response> {
  if (!sameOriginOrAbsent(request, state.config.publicUrl)) return bareResponse(403);
  const form = (await readForm(request)) ?? new FormData();
  const messages = REVIEW_MESSAGES[langOf(request)];
  if (!csrfMatches(session, textField(form, 'csrf'))) {
    const nonce = newNonce();
    return htmlResponse(403, messagePage(langOf(request), nonce, messages.errors.csrf), nonce);
  }
  return action(form);
}

/** Ends the session: its row goes, and the cookie is cleared. A copy of the cookie is worth nothing after this. */
function endSession(state: ServiceState, session: ReviewSession): Response {
  state.stores.sessions.delete(sha256Hex(session.token));
  return seeOther(`${LOGIN}?flash=signed-out`, [sessionCookie(state, '', 0)]);
}
