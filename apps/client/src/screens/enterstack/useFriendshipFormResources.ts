import { useRef } from 'react';
import { useDrizzle } from '../../db';
import { createFriendshipService, type FriendshipService } from '../../services/FriendshipService';
import { createServerService } from '../../services/ServerService';

type ServerService = ReturnType<typeof createServerService>;

/** Owns the friendship and server services used by the form. */
export function useFriendshipFormResources() {
  const drizzleDb = useDrizzle();
  const friendshipServiceRef = useRef<FriendshipService | null>(null);
  const serverServiceRef = useRef<ServerService | null>(null);
  friendshipServiceRef.current ??= createFriendshipService(drizzleDb);
  serverServiceRef.current ??= createServerService(drizzleDb);

  return {
    drizzleDb,
    friendshipServiceRef,
    serverServiceRef,
  };
}
