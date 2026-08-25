import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '../../../common/controls/Button/Button';
import CollapsibleCard from '../../../common/display/CollapsibleCard/CollapsibleCard';
import TextInput from '../../../common/inputs/TextInput/TextInput';
import type { ModeSelect } from '../../../../db/schema';
import { useTheme } from '../../../../theme';
import { getCommonInputStyles } from '../../../../theme/commonStyles';
import { AppAlert } from '../../../../utils/AppAlert';

/**
 * CRUD for a character's modes, in the form. The detail screen only displays them.
 */
interface ModeManagerProps {
  modes: ModeSelect[];
  editable: boolean;
  onCreate: (mode: { name: string; modeChanges: string | null }) => Promise<void>;
  onUpdate: (modeId: string, mode: { name: string; modeChanges: string | null }) => Promise<void>;
  onDelete: (modeId: string) => Promise<void>;
}

export function ModeManager({ modes, editable, onCreate, onUpdate, onDelete }: ModeManagerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const commonInputStyles = getCommonInputStyles(colors);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [changes, setChanges] = useState('');
  const [saving, setSaving] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 12,
          borderBottomColor: colors.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
        name: { color: colors.text, fontSize: 15, fontWeight: '600' },
        changes: { color: colors.textSecondary, marginTop: 4 },
        iconButton: { padding: 8 },
        // The app's inputs have `marginBottom: 0` (see commonStyles), so the vertical spacing has to come from
        // here - without it, label, field and button end up glued together.
        form: { marginTop: 20, gap: 8 },
        label: { color: colors.text, fontWeight: 'bold', marginTop: 8, marginBottom: 6 },
        firstLabel: { marginTop: 0 },
        saveButton: { marginTop: 12 },
        empty: { color: colors.textSecondary, paddingVertical: 12 },
      }),
    [colors],
  );

  const reset = () => {
    setEditingId(null);
    setName('');
    setChanges('');
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      AppAlert.alert(t('error'), t('mode_name_required'));
      return;
    }
    setSaving(true);
    try {
      const payload = { name: name.trim(), modeChanges: changes.trim() || null };
      if (editingId) await onUpdate(editingId, payload);
      else await onCreate(payload);
      reset();
    } catch (error: any) {
      console.error('Failed to save mode:', error);
      AppAlert.alert(t('error'), error?.message || t('modes_save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (mode: ModeSelect) => {
    AppAlert.alert(
      t('mode_delete_title'),
      t('mode_delete_message', { name: mode.name }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await onDelete(mode.id);
              if (editingId === mode.id) reset();
            } catch (error) {
              console.error('Failed to delete mode:', error);
              AppAlert.alert(t('error'), t('modes_save_failed'));
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <CollapsibleCard title={`${t('modes_title')} (${modes.length})`}>
      {modes.length === 0 ? <Text style={styles.empty}>{t('modes_empty')}</Text> : null}
      {modes.map((mode) => (
        <View key={mode.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{mode.name}</Text>
            {mode.modeChanges ? (
              <Text style={styles.changes} numberOfLines={2}>
                {mode.modeChanges}
              </Text>
            ) : null}
          </View>
          {editable ? (
            <>
              <TouchableOpacity
                style={styles.iconButton}
                accessibilityLabel={t('mode_edit')}
                onPress={() => {
                  setEditingId(mode.id);
                  setName(mode.name);
                  setChanges(mode.modeChanges ?? '');
                }}
              >
                <Ionicons name="pencil-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                accessibilityLabel={t('delete')}
                onPress={() => handleDelete(mode)}
              >
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      ))}

      {editable ? (
        <View style={styles.form}>
          <Text style={[styles.label, styles.firstLabel]}>{t('mode_name')}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('mode_name_placeholder')}
            style={commonInputStyles.input}
          />
          <Text style={styles.label}>{t('mode_changes')}</Text>
          <TextInput
            value={changes}
            onChangeText={setChanges}
            placeholder={t('mode_changes_placeholder')}
            multiline
            style={commonInputStyles.input}
          />
          <Button onPress={handleSubmit} disabled={saving} style={styles.saveButton}>
            {editingId ? t('save') : t('modes_add')}
          </Button>
          {editingId ? <Button onPress={reset}>{t('cancel')}</Button> : null}
        </View>
      ) : null}
    </CollapsibleCard>
  );
}

export default ModeManager;
