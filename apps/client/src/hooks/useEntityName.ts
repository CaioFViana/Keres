import { useEffect, useState } from 'react';
import { EntityService } from '../services/EntityService';
import { OperationLogEntityType } from '@keres/shared';
import { useDrizzle } from '../db';

interface UseEntityNameResult {
  entityName: string | undefined;
  loading: boolean;
}

export function useEntityName(entityType: OperationLogEntityType, entityId: string): UseEntityNameResult {
  const [entityName, setEntityName] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const db = useDrizzle();

  useEffect(() => {
    let isMounted = true;

    async function fetchEntityName() {
      if (!entityId) {
        setEntityName(undefined);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const name = await EntityService.getEntityName(db, entityType, entityId); // Pass db as the first argument
        if (isMounted) {
          setEntityName(name);
        }
      } catch (error) {
        console.error(`Failed to fetch name for ${entityType} with ID ${entityId}:`, error);
        if (isMounted) {
          setEntityName(undefined); // Or entityId as fallback
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchEntityName();

    return () => {
      isMounted = false;
    };
  }, [db, entityType, entityId]);

  return { entityName, loading };
}