import { ServerSelect } from '../db/schema';
import { createKeresAxiosInstance } from './apiClient';
import { authTokenManager } from './AuthTokenManager';

/**
 * Chamadas para as rotas `/story-permissions` do servidor vinculado a uma história -
 * gerenciamento de colaboradores, nunca guardado localmente (é o servidor quem sabe quem
 * tem acesso). Usado hoje só pela tela de Configurações da História, pro portão de
 * "desvincular do servidor" (só o dono, só sem colaboradores) e a lista que o torna possível.
 */

export interface StoryCollaborator {
  id: string;
  storyId: string;
  userId: string;
  permissionType: 'reader' | 'writer';
  user: { id: string; username: string } | null;
}

function clientFor(server: ServerSelect) {
  const client = createKeresAxiosInstance({ baseURL: server.url });
  client.setTokenProvider(authTokenManager);
  client.setActiveServer(server);
  return client;
}

export const storyPermissionApi = {
  /** Lança com `response.status === 403` quando quem chama não é o dono da história no servidor. */
  async getCollaborators(server: ServerSelect, storyId: string): Promise<StoryCollaborator[]> {
    const response = await clientFor(server).get<StoryCollaborator[]>(
      `/story-permissions/story/${storyId}`,
    );
    return response.data;
  },

  async removeCollaborator(
    server: ServerSelect,
    storyId: string,
    targetUserId: string,
  ): Promise<void> {
    await clientFor(server).delete(`/story-permissions/story/${storyId}/user/${targetUserId}`);
  },

  /** Grants (or updates, if one already exists) a collaborator's permission on a story. Caller must re-fetch `getCollaborators` afterward - the upsert response doesn't carry the joined `user` info. */
  async grantCollaborator(
    server: ServerSelect,
    storyId: string,
    targetUserId: string,
    permissionType: 'reader' | 'writer',
  ): Promise<void> {
    await clientFor(server).post('/story-permissions/', { storyId, targetUserId, permissionType });
  },

  /** Same upsert endpoint, named explicitly for the edit-permission UI. */
  async updateCollaboratorPermission(
    server: ServerSelect,
    storyId: string,
    targetUserId: string,
    permissionType: 'reader' | 'writer',
  ): Promise<void> {
    await this.grantCollaborator(server, storyId, targetUserId, permissionType);
  },
};
