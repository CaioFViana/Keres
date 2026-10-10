import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import ConversationListItem from '../../components/features/messages/ConversationListItem';
import { useScreenTour } from '../../guides/useScreenTour';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useMessageInbox } from '../../hooks/useMessageInbox';
import type { FriendshipStackParamList } from '../../navigation/StorySelectionStack';
import type { InboxEntry, MessageContact } from '../../services/MessageService';
import { useUnseenMessagesStore } from '../../state/unseenMessagesStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { type ConversationPeer, conversationKey } from '../../utils/conversationKey';
import GuideAnchor from '@/src/guides/GuideAnchor';

type MessageInboxNavigationProp = NativeStackNavigationProp<
  FriendshipStackParamList,
  'MessageInbox'
>;

/** A contact as one string for the picker: `serverId|admin` or `serverId|friendId`. */
const contactValue = (contact: Pick<MessageContact, 'serverId' | 'kind' | 'userId'>) =>
  `${contact.serverId}|${contact.kind === 'admin' ? 'admin' : contact.userId}`;

/** The conversation an entry of the inbox stands for, as `conversationKey` wants it. */
const peerOfEntry = (entry: Pick<InboxEntry, 'kind' | 'userId'>): ConversationPeer =>
  entry.kind === 'admin' ? { kind: 'admin' } : { kind: 'direct', userId: entry.userId ?? '' };

/** The inbox: every conversation over the registered servers, and a way to start a new one. */
const MessageInboxScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<MessageInboxNavigationProp>();
  const { inbox, contacts, loading } = useMessageInbox();
  const unseen = useUnseenMessagesStore((state) => state.unseen);
  const [picking, setPicking] = useState(false);
  useScreenTour('MessageInbox');

  const togglePicker = useCallback(() => setPicking((open) => !open), []);
  useScreenHeader({
    target: 'parent',
    title: t('messages_title'),
    actions: [
      { id: 'new-message', icon: 'create-outline', label: t('new_message'), onPress: togglePicker },
    ],
  });

  const open = useCallback(
    (contact: MessageContact) => {
      setPicking(false);
      navigation.navigate('Conversation', {
        serverId: contact.serverId,
        peer: contact.kind === 'admin' ? 'admin' : (contact.userId ?? ''),
        peerName: contact.kind === 'admin' ? undefined : contact.name,
      });
    },
    [navigation],
  );

  const options = useMemo(
    () =>
      contacts.map((contact) => ({
        value: contactValue(contact),
        label:
          contact.kind === 'admin'
            ? t('messages_administrators_on', { server: contact.serverName })
            : `${contact.tag ? `@${contact.tag} — ` : ''}${contact.name} (${contact.serverName})`,
      })),
    [contacts, t],
  );

  const onPick = useCallback(
    (value: string | null) => {
      const contact = contacts.find((candidate) => contactValue(candidate) === value);
      if (contact) open(contact);
    },
    [contacts, open],
  );

  const when = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' });

  const renderEntry = ({ item }: { item: InboxEntry }) => {
    const text = item.lastMessage.mine
      ? t('messages_you', { text: item.lastMessage.body })
      : item.lastMessage.body;
    return (
      <ConversationListItem
        title={item.kind === 'admin' ? t('messages_administrators') : item.name}
        subtitle={
          item.kind === 'admin'
            ? item.serverName
            : `${item.tag ? `@${item.tag} · ` : ''}${item.serverName}`
        }
        preview={text}
        when={when(item.lastMessage.createdAt)}
        isAdmin={item.kind === 'admin'}
        avatar={{
          color: item.avatarColor,
          icon: item.avatarIcon,
          seed: item.userId ?? item.serverId,
        }}
        unseen={unseen[conversationKey(item.serverId, peerOfEntry(item))] !== undefined}
        unseenLabel={
          item.kind === 'admin'
            ? t('messages_unseen_admin_on', { server: item.serverName })
            : t('messages_unseen_from', { name: item.name })
        }
        onPress={() => open(item)}
      />
    );
  };

  const commonContainerStyles = getCommonContainerStyles(colors);

  if (loading) {
    return <ScreenLoading message={t('loading')} />;
  }

  return (
    <View style={commonContainerStyles.container}>
      {picking && (
        <View style={styles.picker}>
          {options.length > 0 ? (
            <SingleSelectPill
              options={options}
              value={null}
              onValueChange={onPick}
              placeholder={t('message_recipient_placeholder')}
            />
          ) : (
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              {t('messages_no_contacts')}
            </Text>
          )}
        </View>
      )}
      {inbox.unreachableServerIds.length > 0 && (
        <Text style={[styles.hint, { color: colors.error }]}>
          {t('messages_servers_unreachable')}
        </Text>
      )}
      <GuideAnchor screen="Messages" part="list" style={styles.listAnchor}>
        <FlatList
          data={inbox.entries}
          renderItem={renderEntry}
          keyExtractor={(entry) => `${entry.serverId}|${entry.userId ?? 'admin'}`}
          ListEmptyComponent={
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              {t('messages_no_conversations')}
            </Text>
          }
        />
      </GuideAnchor>
    </View>
  );
};

const styles = StyleSheet.create({
  picker: { marginBottom: 16 },
  listAnchor: { flex: 1 },
  hint: { fontSize: 14, textAlign: 'center', marginVertical: 12 },
});

export default MessageInboxScreen;
