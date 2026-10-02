import { normalizeUserTag, USER_TAG_MAX_LENGTH, USER_TAG_MIN_LENGTH } from '@keres/shared';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ServerSelect } from '../db/schema';
import { isOfflineError } from '../services/apiClient';
import { userApiService } from '../services/UserApiService';
import { AppAlert } from '../utils/AppAlert';

/** What the editor needs of the service that stores the server locally. */
interface TagStore {
  updateServer: (serverId: string, patch: { tag: string }) => Promise<unknown>;
}

/**
 * Editing the user's own tag on one server: the field's state, and saving - first on the server
 * (which refuses a tag that is taken or malformed), then in the local copy of the server.
 */
export function useServerTagEditor(
  server: Pick<ServerSelect, 'id' | 'url' | 'tag'> | undefined,
  store: TagStore,
  onSaved: (serverId: string, tag: string) => void,
) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const start = useCallback(() => {
    setValue(server?.tag || '');
    setEditing(true);
  }, [server?.tag]);

  const cancel = useCallback(() => {
    setEditing(false);
    setValue('');
  }, []);

  const save = useCallback(async () => {
    if (!server) return;
    // Sent the way it is stored (lowercase, no spaces), so what is checked is what is saved.
    const newTag = normalizeUserTag(value);
    if (!newTag || newTag === server.tag) {
      cancel();
      return;
    }
    if (newTag.length < USER_TAG_MIN_LENGTH || newTag.length > USER_TAG_MAX_LENGTH) {
      AppAlert.alert(t('error'), t('invalid_friend_id_format'));
      return;
    }

    setSaving(true);
    try {
      const updated = await userApiService.updateOwnTag(server as ServerSelect, newTag);
      await store.updateServer(server.id, { tag: updated.tag });
      onSaved(server.id, updated.tag);
      cancel();
    } catch (err: any) {
      if (isOfflineError(err)) {
        AppAlert.alert(t('error'), t('server_unreachable'));
      } else if (err?.response?.status === 409) {
        AppAlert.alert(t('error'), t('tag_already_taken'));
      } else if (err?.response?.status === 400) {
        AppAlert.alert(t('error'), t('invalid_tag_format'));
      } else {
        AppAlert.alert(t('error'), t('failed_to_update_tag'));
      }
    } finally {
      setSaving(false);
    }
  }, [server, value, store, onSaved, cancel, t]);

  return { editing, value, setValue, saving, start, cancel, save };
}
