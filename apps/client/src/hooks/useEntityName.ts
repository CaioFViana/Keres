import { OperationLogEntityType } from '@keres/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../db';
import { EntityService } from '../services/EntityService';

interface UseEntityNameResult {
  entityName: string | undefined;
  loading: boolean;
}

export function useEntityName(
  entityType: OperationLogEntityType,
  entityId: string,
  storyId: string,
): UseEntityNameResult {
  const [entityName, setEntityName] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const db = useDrizzle();
  const { t } = useTranslation();

  useEffect(() => {
    let isMounted = true;

    async function fetchEntityName() {
      if (!entityId || !storyId) {
        setEntityName(undefined);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        // Pass t as an argument to EntityService.getEntityName
        const name = await EntityService.getEntityName(db, entityType, entityId, storyId, t);
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
  }, [db, entityType, entityId, storyId, t]);

  return { entityName, loading };
}
