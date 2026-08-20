import type { PublicationLabelMode, ShowcaseVisibility, StoryPublication } from '@keres/shared';
import { ServerSelect } from '../db/schemas/servers';
import { createKeresAxiosInstance } from './apiClient';
import { authTokenManager } from './AuthTokenManager';

export interface StoryShowcaseState {
  isPublished: boolean;
  visibility: ShowcaseVisibility;
  labelMode: PublicationLabelMode;
  hasPassword: boolean;
  publications: StoryPublication[];
}

/**
 * As rotas de publicação, faladas com um servidor específico.
 *
 * Mesmo motivo de `FriendshipApiService` para não usar o `apiClient` compartilhado: aquele
 * aponta para um servidor só de cada vez (o último que a sincronização ou a história aberta
 * definiu), e a tela de publicação lista histórias de todos os servidores registrados.
 */
export class PublicationApiService {
  private clientFor(server: ServerSelect) {
    const client = createKeresAxiosInstance({ baseURL: server.url });
    client.setTokenProvider(authTokenManager);
    client.setActiveServer(server);
    return client;
  }

  /** Toda publicação de história que esta conta pode ler neste servidor - dela ou compartilhada. */
  async listVisible(server: ServerSelect): Promise<StoryPublication[]> {
    const response = await this.clientFor(server).get('/stories/publications/mine');
    return response.data;
  }

  async getStoryShowcase(server: ServerSelect, storyId: string): Promise<StoryShowcaseState> {
    const response = await this.clientFor(server).get(`/stories/${storyId}/publications`);
    return response.data;
  }

  /**
   * `visibility` viaja junto da publicação de propósito: ela descreve como *esta* publicação
   * deve ficar exposta, e o servidor a regrava em toda publicação. Uma chamada separada só
   * quando há senha faria o caminho "publicar sem senha" não mexer em nada, deixando uma
   * proteção anterior valendo sem ninguém pedir.
   */
  async publish(
    server: ServerSelect,
    storyId: string,
    operationVersion: number,
    labelMode: PublicationLabelMode,
    visibility: ShowcaseVisibility = 'public',
    password?: string,
  ): Promise<StoryPublication> {
    const response = await this.clientFor(server).post(`/stories/${storyId}/publications`, {
      operationVersion,
      labelMode,
      visibility,
      password,
    });
    return response.data;
  }

  async setVisibility(
    server: ServerSelect,
    storyId: string,
    visibility: ShowcaseVisibility,
    password?: string,
  ): Promise<void> {
    await this.clientFor(server).put(`/stories/${storyId}/showcase`, { visibility, password });
  }

  async deletePublication(
    server: ServerSelect,
    storyId: string,
    publicationId: string,
  ): Promise<void> {
    await this.clientFor(server).delete(`/stories/${storyId}/publications/${publicationId}`);
  }

  async unpublish(server: ServerSelect, storyId: string): Promise<void> {
    await this.clientFor(server).delete(`/stories/${storyId}/publications`);
  }
}

export const publicationApiService = new PublicationApiService();
