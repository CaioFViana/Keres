import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import { MESSAGE_BODY_MAX_LENGTH } from '@keres/shared/metadata/MessageLimits';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MessageBubble from '../../components/features/messages/MessageBubble';
import MessageComposer from '../../components/features/messages/MessageComposer';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useConversation } from '../../hooks/useConversation';
import type { FriendshipStackParamList } from '../../navigation/StorySelectionStack';
import type { MessagePeerRef } from '../../services/MessageApiService';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';

type ConversationScreenRouteProp = RouteProp<FriendshipStackParamList, 'Conversation'>;

/** The route carries the peer as one string: `admin`, or the friend's id on the server. */
export const peerFromParam = (peer: string): MessagePeerRef =>
  peer === 'admin' ? { kind: 'admin' } : { kind: 'direct', userId: peer };

const ConversationScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const route = useRoute<ConversationScreenRouteProp>();
  const { serverId, peer: peerParam, peerName } = route.params;
  const peer = useMemo(() => peerFromParam(peerParam), [peerParam]);
  const isAdmin = peer.kind === 'admin';

  const conversation = useConversation(serverId, peer);
  const clearConversation = conversation.clear;
  const hasMessages = conversation.messages.length > 0;

  useScreenHeader({
    target: 'parent',
    title: isAdmin ? t('messages_administrators') : peerName || t('messages_title'),
    actions: [
      {
        id: 'clear-conversation',
        icon: 'trash-bin-outline',
        label: t('message_clear_title'),
        onPress: clearConversation,
        visible: hasMessages,
      },
    ],
  });

  const when = useCallback(
    (iso: string) =>
      new Date(iso).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' }),
    [i18n.language],
  );

  const commonContainerStyles = getCommonContainerStyles(colors);

  if (conversation.loading) {
    return <ScreenLoading message={t('loading')} />;
  }

  return (
    <KeyboardAvoidingView
      style={[commonContainerStyles.container, styles.screen]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {isAdmin && (
        <Text style={[styles.banner, { color: colors.textSecondary }]}>
          {t('messages_administrators_hint')}
        </Text>
      )}
      {conversation.unavailable && (
        <Text style={[styles.banner, { color: colors.error }]}>{t('messages_unavailable')}</Text>
      )}
      {conversation.messages.length === 0 ? (
        // Outside the list on purpose: an inverted list is drawn upside down and each platform turns its empty
        // state back differently (React Native does it itself, the web does not), so a flip applied here came
        // out mirrored on a phone.
        <View style={styles.emptyContainer}>
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            {t('conversation_empty')}
          </Text>
        </View>
      ) : (
        <FlatList
          testID="conversation-list"
          style={styles.list}
          // Newest first, drawn from the bottom up: the latest message sits next to the field, and
          // older ones are loaded as the reader scrolls toward them.
          inverted
          data={conversation.messages}
          keyExtractor={(message) => message.id}
          renderItem={({ item }) => (
            <MessageBubble
              body={item.body}
              mine={item.mine}
              when={when(item.createdAt)}
              onDelete={() => conversation.deleteMessage(item.id)}
            />
          )}
          onEndReached={() => void conversation.loadOlder()}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            conversation.loadingMore ? <ActivityIndicator color={colors.primary} /> : <View />
          }
        />
      )}
      <MessageComposer
        maxLength={MESSAGE_BODY_MAX_LENGTH}
        sending={conversation.sending}
        remainingToday={conversation.remainingToday}
        onSend={conversation.send}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: { paddingBottom: 12 },
  list: { flex: 1 },
  banner: { fontSize: 13, textAlign: 'center', marginBottom: 8 },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  empty: { textAlign: 'center', paddingVertical: 24 },
});

export default ConversationScreen;
