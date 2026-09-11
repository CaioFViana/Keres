import type { RefObject } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ServerSelect } from '../../db/schemas/servers';
import type { createServerService } from '../../services/ServerService';
import { AppAlert } from '../../utils/AppAlert';

type ServerService = ReturnType<typeof createServerService>;

type UseFriendshipFormStateOptions = {
  serverServiceRef: RefObject<ServerService | null>;
};

/** Owns field state and server-list hydration for the Friendship form. */
export function useFriendshipFormState({ serverServiceRef }: UseFriendshipFormStateOptions) {
  const { t } = useTranslation();
  const [friendTag, setFriendTag] = useState('');
  const [resolvedFriendUserId, setResolvedFriendUserId] = useState<string | null>(null);
  const [selectedServerId, setSelectedServerId] = useState('');
  const [servers, setServers] = useState<ServerSelect[]>([]);
  const [friendUsername, setFriendUsername] = useState<string | null>(null);
  const [isCheckingFriend, setIsCheckingFriend] = useState(false);
  const [friendFound, setFriendFound] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchServers = async () => {
      if (!serverServiceRef.current) {
        return;
      }
      try {
        const fetchedServers = await serverServiceRef.current.getAllServers();
        setServers(fetchedServers);
        if (fetchedServers.length === 1) {
          setSelectedServerId(fetchedServers[0].id);
        }
      } catch (error) {
        console.error('Error fetching servers for friendship form:', error);
        AppAlert.alert(t('error'), t('failed_to_load_form_data'));
      }
    };
    void fetchServers();
  }, [serverServiceRef, t]);

  const selectedServer = servers.find((s) => s.id === selectedServerId);

  const handleServerChange = (serverId: string | null) => {
    setSelectedServerId(serverId || '');
    setFriendUsername(null);
    setFriendFound(null);
    setResolvedFriendUserId(null);
  };

  const handleFriendTagChange = (text: string) => {
    setFriendTag(text);
    setFriendUsername(null);
    setFriendFound(null);
    setResolvedFriendUserId(null);
  };

  return {
    friendTag,
    resolvedFriendUserId,
    setResolvedFriendUserId,
    selectedServerId,
    servers,
    friendUsername,
    setFriendUsername,
    isCheckingFriend,
    setIsCheckingFriend,
    friendFound,
    setFriendFound,
    selectedServer,
    handleServerChange,
    handleFriendTagChange,
  };
}

export type FriendshipFormState = ReturnType<typeof useFriendshipFormState>;
