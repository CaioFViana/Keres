import { eq } from 'drizzle-orm';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../db';
import type { ServerSelect} from '../db/schema';
import { users } from '../db/schema';
import { friendshipApiService } from '../services/FriendshipApiService';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { entityEventEmitter } from '../utils/EventEmitter';

export interface ResolvedUserProfile {
  id: string;
  name: string;
  avatarColor?: string | null;
  avatarIcon?: string | null;
  isCurrentUser: boolean;
}

/** Compartilhado entre toda instância do hook (não por componente) - mesmo cache que
 *  `FavoritedByList` mantinha privadamente antes desta extração. */
const remoteProfileCache = new Map<string, Promise<ResolvedUserProfile | undefined>>();

/**
 * Resolve o perfil (nome + avatar) de um `userId`, priorizando o cache local de usuários
 * (mantido em dia pela sincronização de friendship) e caindo para uma busca de rede
 * cacheada por servidor quando necessário. Extraído de `FavoritedByList` para ser
 * reutilizado por qualquer lugar que precise mostrar "quem fez X" com nome+avatar
 * (comentários, por exemplo) sem duplicar essa lógica.
 *
 * Retorna a função resolvedora (não um perfil já resolvido) porque os consumidores
 * tipicamente resolvem vários perfis por render via `Promise.all`, não um só.
 */
export function useUserProfileResolver() {
  const db = useDrizzle();
  const { t } = useTranslation();
  const { userId: localUserId, username: localUsername } = useUserSettingsStore();

  const resolveProfile = useCallback(
    async (userId: string, storyServer: ServerSelect | undefined): Promise<ResolvedUserProfile> => {
      const isCurrentUser =
        (!storyServer && userId === localUserId) || storyServer?.idUser === userId;
      // Friendship sync keeps this local user row enriched with the friend's current name,
      // icon and color. Prefer it over the network cache so a realtime refresh is immediately
      // reflected by every consumer already mounted.
      const localProfile = await db.query.users.findFirst({
        where: eq(users.idUser, userId),
        columns: { displayName: true, avatarColor: true, avatarIcon: true },
      });
      if (localProfile) {
        return {
          id: userId,
          name:
            localProfile.displayName ||
            (isCurrentUser ? storyServer?.userName || localUsername : undefined) ||
            t('user_not_found'),
          avatarColor: localProfile.avatarColor,
          avatarIcon: localProfile.avatarIcon,
          isCurrentUser,
        };
      }

      if (!storyServer && isCurrentUser) {
        return { id: userId, name: localUsername || t('user_not_found'), isCurrentUser: true };
      }

      if (storyServer) {
        const cacheKey = `${storyServer.id}:${userId}`;
        let request = remoteProfileCache.get(cacheKey);
        if (!request) {
          request = friendshipApiService
            .getUserDetails(storyServer, userId)
            .then((user) =>
              user
                ? {
                    id: user.id,
                    name: user.username,
                    avatarColor: user.avatarColor,
                    avatarIcon: user.avatarIcon,
                    isCurrentUser: false,
                  }
                : undefined,
            )
            .catch(() => {
              remoteProfileCache.delete(cacheKey);
              return undefined;
            });
          remoteProfileCache.set(cacheKey, request);
        }
        const remoteProfile = await request;
        if (remoteProfile) return { ...remoteProfile, isCurrentUser };
      }

      return { id: userId, name: userId, isCurrentUser };
    },
    [db, localUserId, localUsername, t],
  );

  // Só invalida o cache compartilhado - quem quiser re-buscar perfis já exibidos precisa
  // do próprio listener de `friendship_changed` chamando seu próprio refetch (ver
  // FavoritedByList, que mantém o dele mesmo após esta extração).
  useEffect(() => {
    const handleFriendshipChange = () => remoteProfileCache.clear();
    entityEventEmitter.on('friendship_changed', handleFriendshipChange);
    return () => {
      entityEventEmitter.off('friendship_changed', handleFriendshipChange);
    };
  }, []);

  return resolveProfile;
}
