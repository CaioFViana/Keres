import axios from 'axios';
import { and, eq } from 'drizzle-orm';
import { AppDrizzleClient } from '../db';
import { ServerSelect, servers } from '../db/schema';
import { useUserSettingsStore } from '../state/userSettingsStore';
import apiClient from './apiClient';
import { hostedApiOrigin, usesHttpOnlyCookieSession } from './browserCookieSession';
import { createServerService } from './ServerService';

interface HostedMeResponse {
  userId: string;
  username: string;
  tag: string;
}

/**
 * Recupera a sessão web depois de um F5: os JWT estão no cookie HttpOnly, não no cofre.
 * Cria ou atualiza o servidor local apontando para a origem desta página. Mobile e
 * Electron nunca chamam isto com efeito — `usesHttpOnlyCookieSession()` é falso lá.
 */
export async function restoreHostedCookieSession(
  db: AppDrizzleClient,
): Promise<ServerSelect | null> {
  if (!usesHttpOnlyCookieSession()) {
    return null;
  }

  const origin = hostedApiOrigin();
  let me: HostedMeResponse;
  try {
    const response = await axios.get<HostedMeResponse>(`${origin}/auth/me`, {
      timeout: 5000,
      validateStatus: () => true,
    });
    if (response.status !== 200 || !response.data?.userId || !response.data?.username) {
      return null;
    }
    me = response.data;
  } catch {
    return null;
  }

  const existing = await db.query.servers.findFirst({
    where: and(eq(servers.url, origin), eq(servers.isDeleted, false)),
  });

  let server: ServerSelect;
  if (existing) {
    await db
      .update(servers)
      .set({
        idUser: me.userId,
        userName: me.username,
        tag: me.tag,
        updatedAt: new Date(),
      })
      .where(eq(servers.id, existing.id))
      .run();
    server = {
      ...existing,
      idUser: me.userId,
      userName: me.username,
      tag: me.tag,
    };
  } else {
    server = await createServerService(db).createServer({
      idUser: me.userId,
      userName: me.username,
      tag: me.tag ?? me.username,
      name: origin.replace(/^https?:\/\//, ''),
      url: origin,
    });
  }

  useUserSettingsStore.getState().setActiveServer(server);
  apiClient.setBaseUrl(origin);
  apiClient.setActiveServer(server);
  return server;
}
