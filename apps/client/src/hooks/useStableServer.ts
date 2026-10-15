import { useState } from 'react';
import type { ServerSelect } from '@/src/db/schema';

type ServerIdentity = Pick<ServerSelect, 'id' | 'url' | 'idUser'>;

const sameServer = (a?: ServerIdentity, b?: ServerIdentity): boolean =>
  !!a && !!b && a.id === b.id && a.url === b.url && a.idUser === b.idUser;

/**
 * The server as the network hooks should see it: the same object for as long as nothing that changes what they ask
 * has changed (which server, at which address, for which account).
 *
 * `useServerStatuses` reads the servers again from the database every few seconds, and every read hands out new
 * objects with the same content. A hook or an effect that lists `server` among its dependencies then asked its
 * question again on every read - the plan, the payments and the terms were each requested ten times in half a minute
 * by a screen nobody touched. What must refresh those answers is an event (a payment, a change of server), not the
 * clock; and what the screen draws from the server itself (its name, its saved texts) it keeps reading from the
 * live object.
 */
export function useStableServer(server: ServerSelect | undefined): ServerSelect | undefined {
  const [stable, setStable] = useState(server);
  if (server !== stable && !sameServer(server, stable)) setStable(server);
  return sameServer(server, stable) ? stable : server;
}
