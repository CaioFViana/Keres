import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useTheme } from '../../../theme';
import ModalHeader from '@/src/components/layout/ModalHeader/ModalHeader';

type Role = 'reader' | 'writer';

interface InviteToStoryModalProps {
  visible: boolean;
  onClose: () => void;
  friendName: string;
  serverName: string;
  /** The stories that can be offered; `null` while they are being read. */
  stories: { id: string; title: string }[] | null;
  busy: boolean;
  /** Resolves to whether the invitation went out; the dialog closes when it did. */
  onInvite: (storyId: string, role: Role) => Promise<boolean>;
}

/**
 * Choose one of the person's stories and the role to offer a friend. With no story to offer it says how a
 * story gets to the server, which is the only way one becomes offerable.
 */
const InviteToStoryModal: React.FC<InviteToStoryModalProps> = ({
  visible,
  onClose,
  friendName,
  serverName,
  stories,
  busy,
  onInvite,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [storyId, setStoryId] = useState<string | null>(null);
  const [role, setRole] = useState<Role>('reader');

  useEffect(() => {
    if (!visible) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a fresh choice each time the dialog opens.
    setStoryId(null);
    setRole('reader');
  }, [visible]);

  const noStories = stories !== null && stories.length === 0;

  const send = async () => {
    if (!storyId) return;
    if (await onInvite(storyId, role)) onClose();
  };

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      inset="regular"
      contentStyle={styles.content}
    >
      <ModalHeader title={t('friend_invite_modal_title', { name: friendName })} />

      {noStories ? (
        <Text style={[styles.muted, { color: colors.textSecondary }]} testID="invite-no-stories">
          {t('friend_invite_none', { server: serverName })}
        </Text>
      ) : (
        <>
          <Text style={[styles.label, { color: colors.text }]}>{t('friend_invite_pick')}</Text>
          <ScrollView style={styles.list}>
            {(stories ?? []).map((story) => {
              const selected = story.id === storyId;
              return (
                <Pressable
                  key={story.id}
                  testID={`invite-story-${story.id}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setStoryId(story.id)}
                  style={styles.storyRow}
                >
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={colors.primary}
                  />
                  <Text style={[styles.storyTitle, { color: colors.text }]} numberOfLines={2}>
                    {story.title}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[styles.label, { color: colors.text }]}>{t('friend_invite_role')}</Text>
          <View style={styles.roles}>
            {(['reader', 'writer'] as const).map((option) => (
              <Pressable
                key={option}
                testID={`invite-role-${option}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: role === option }}
                onPress={() => setRole(option)}
                style={[
                  styles.role,
                  { borderColor: colors.border },
                  role === option && {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Text
                  style={{
                    color: role === option ? colors.onPrimary : colors.text,
                    fontWeight: role === option ? 'bold' : 'normal',
                  }}
                >
                  {t(option === 'writer' ? 'permission_writer' : 'permission_reader')}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <FormActions>
        <Button variant="secondary" onPress={onClose}>
          {t('cancel')}
        </Button>
        {/* With no story to offer there is nothing to send: only the way out. */}
        {!noStories && (
          <Button
            onPress={() => void send()}
            disabled={!storyId || busy}
            testID="invite-to-story-confirm"
          >
            {t('friend_invite_send')}
          </Button>
        )}
      </FormActions>
    </ResponsiveModal>
  );
};

const styles = StyleSheet.create({
  content: { gap: 10 },
  title: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: 'bold', marginTop: 6 },
  muted: { fontSize: 14, lineHeight: 20 },
  list: { maxHeight: 260 },
  storyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  storyTitle: { flex: 1, fontSize: 16 },
  roles: { flexDirection: 'row', gap: 8 },
  role: { borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
});

export default InviteToStoryModal;
