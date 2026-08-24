import axios from 'axios';
import type { AppDrizzleClient } from '../db';
import type { ServerSelect } from '../db/schema';
import { useUserSettingsStore } from '../state/userSettingsStore';
import apiClient, { apiUrl } from './apiClient';
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
    const response = await axios.get<HostedMeResponse>(apiUrl(origin, '/auth/me'), {
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

  const serverService = createServerService(db);
  const existing = await serverService.getServerByUrl(origin);

  let server: ServerSelect;
  if (existing) {
    await serverService.updateServer(existing.id, {
      idUser: me.userId,
      userName: me.username,
      tag: me.tag,
    });
    server = {
      ...existing,
      idUser: me.userId,
      userName: me.username,
      tag: me.tag,
    };
  } else {
    server = await serverService.createServer({
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
