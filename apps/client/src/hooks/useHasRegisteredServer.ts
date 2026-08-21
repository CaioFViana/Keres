import { useEffect, useState } from 'react';
import { useDrizzle } from '../db';
import { createServerService } from '../services/ServerService';
import { entityEventEmitter } from '../utils/EventEmitter';

/**
 * Se este aparelho tem ao menos um servidor registrado.
 *
 * A fonte honesta é a tabela `servers` (`activeServer` só existe enquanto uma história ligada
 * a servidor está aberta, e `stories.serverId` é por história), mas lê-la é assíncrono - daí
 * um hook, e não um seletor de store. Reage a `server_connection_changed`, o mesmo evento que
 * `SyncInitializer` já escuta ao registrar ou remover um servidor.
 */
export function useHasRegisteredServer(): boolean {
  const drizzleDb = useDrizzle();
  const [hasServers, setHasServers] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const servers = await createServerService(drizzleDb).getAllServers();
        if (!cancelled) {
          setHasServers(servers.length > 0);
        }
      } catch (error) {
        // Falha de leitura não pode derrubar a navegação; assume "nenhum" e tenta de novo no
        // próximo evento.
        console.log('useHasRegisteredServer: could not read servers.', error);
        if (!cancelled) {
          setHasServers(false);
        }
      }
    };

    check();
    entityEventEmitter.on('server_connection_changed', check);
    return () => {
      cancelled = true;
      entityEventEmitter.off('server_connection_changed', check);
    };
  }, [drizzleDb]);

  return hasServers;
}
