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
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MessageBubble from '../../components/features/messages/MessageBubble';
import MessageComposer from '../../components/features/messages/MessageComposer';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useConversation } from '../../hooks/useConversation';
import { useKeyboardOverlap } from '../../hooks/useKeyboardOverlap';
import type { FriendshipStackParamList } from '../../navigation/StorySelectionStack';
import type { MessagePeerRef } from '../../services/MessageApiService';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';

/** The least room left above the keyboard, on top of what is measured, on any platform. */
const KEYBOARD_ROOM_MIN = 40;
/** What is added to the status bar's height on Android (see `keyboardRoom`). */
const KEYBOARD_ROOM_ANDROID_MARGIN = 12;

const androidStatusBarHeight = () =>
  Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;

/**
 * Extra room left above the keyboard, on top of what is measured. The measurement is of one container against the
 * keyboard's reported top, and the two do not always agree to the last dp: on Android the keyboard's top is
 * reported from the top of the screen and the container is measured from under the status bar, so the lift falls
 * short by about the status bar's height there (and a field with its last line half covered is worse than a small
 * gap). So on Android the room is at least the status bar plus a margin; elsewhere a fixed minimum, because the
 * measurement is not proven exact on any platform.
 */
export const keyboardRoom = (statusBarHeight = androidStatusBarHeight()): number =>
  Math.max(
    KEYBOARD_ROOM_MIN,
    statusBarHeight > 0 ? statusBarHeight + KEYBOARD_ROOM_ANDROID_MARGIN : 0,
  );

/** How much the field is lifted: what the keyboard covers plus the room, and nothing while the keyboard is down. */
export const liftAboveKeyboard = (overlap: number, room = keyboardRoom()): number =>
  overlap > 0 ? overlap + room : 0;

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

  // The keyboard's cover is measured, not inferred: `KeyboardAvoidingView` guesses from its own frame, and
  // with the header above it and Android drawing edge to edge the guess left the field under the keyboard.
  const {
    ref: keyboardRef,
    overlap: keyboardOverlap,
    onLayout: onKeyboardLayout,
  } = useKeyboardOverlap(true);

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
    <View
      ref={keyboardRef}
      onLayout={onKeyboardLayout}
      // Measured in window coordinates for the keyboard overlap: Android may flatten a view that only lays out.
      collapsable={false}
      testID="conversation-screen"
      style={[
        commonContainerStyles.container,
        { paddingBottom: 12 + liftAboveKeyboard(keyboardOverlap) },
      ]}
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
          // With the keyboard open, a tap on a message's bin or on send must act at once, not first dismiss it.
          keyboardShouldPersistTaps="handled"
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
    </View>
  );
};

const styles = StyleSheet.create({
  list: { flex: 1 },
  banner: { fontSize: 13, textAlign: 'center', marginBottom: 8 },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  empty: { textAlign: 'center', paddingVertical: 24 },
});

export default ConversationScreen;
