import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import { type FriendAction, promptFriendActions } from './promptFriendActions';

/** What the friendship is right now, as far as the person's own buttons go. */
export type FriendDetailMode = 'received' | 'sent' | 'friend' | 'blocked-by-me' | 'blocked-by-them';

interface FriendDetailActionsProps {
  mode: FriendDetailMode;
  /** A narrow screen shares the width between the buttons; a wide one keeps each at its own size. */
  compact: boolean;
  friendName: string;
  /** A conversation already exists: the way in says "continue" instead of "send". */
  hasConversation: boolean;
  onMessage: () => void;
  onInvite: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
  onUnblock: () => void;
  onUnfriend: () => void;
  onBlock: () => void;
}

/**
 * The buttons of a friend's page. What the person does most sits first and filled; what is offered next
 * to it is outlined; what ends something (remove, block) is behind "More", where a slip costs nothing.
 * On a narrow screen they share the width in equal parts, on a wide one each keeps the size of its word.
 */
const FriendDetailActions: React.FC<FriendDetailActionsProps> = ({
  mode,
  compact,
  friendName,
  hasConversation,
  onMessage,
  onInvite,
  onAccept,
  onDecline,
  onCancel,
  onUnblock,
  onUnfriend,
  onBlock,
}) => {
  const { t } = useTranslation();
  const cell = compact ? styles.cell : styles.natural;
  const messageLabel = compact
    ? t('friend_message_short')
    : hasConversation
      ? t('friend_continue_conversation')
      : t('send_message');

  const blockAction: FriendAction = {
    label: t('friend_block'),
    destructive: true,
    onPress: onBlock,
  };
  // What ends something is behind one button, chosen in the system's dialog like the rest of the app's choices.
  const more = (actions: FriendAction[]) => (
    <Button
      variant="secondary"
      onPress={() => promptFriendActions(t, friendName, actions)}
      style={cell}
      testID="friend-detail-menu"
      accessibilityLabel={t('friend_more_actions', { name: friendName })}
    >
      {t('friend_more')}
    </Button>
  );

  return (
    <View style={styles.row} testID="friend-detail-actions">
      {mode === 'friend' && (
        <>
          <Button onPress={onMessage} style={cell} testID="friend-detail-message">
            {messageLabel}
          </Button>
          <Button variant="secondary" onPress={onInvite} style={cell} testID="friend-detail-invite">
            {compact ? t('friend_invite_short') : t('friend_invite_to_story')}
          </Button>
          {more([
            { label: t('friend_unfriend'), destructive: true, onPress: onUnfriend },
            blockAction,
          ])}
        </>
      )}

      {mode === 'received' && (
        <>
          <Button onPress={onAccept} style={cell} testID="friend-detail-accept">
            {t('friend_accept')}
          </Button>
          <Button
            variant="secondary"
            onPress={onDecline}
            style={cell}
            testID="friend-detail-decline"
          >
            {t('friend_decline')}
          </Button>
          {more([blockAction])}
        </>
      )}

      {mode === 'sent' && (
        <Button
          variant="secondary"
          onPress={onCancel}
          style={compact ? styles.cell : styles.natural}
          testID="friend-detail-cancel"
        >
          {t('friend_cancel_request')}
        </Button>
      )}

      {mode === 'blocked-by-me' && (
        <Button
          variant="secondary"
          onPress={onUnblock}
          style={compact ? styles.cell : styles.natural}
          testID="friend-detail-unblock"
        >
          {t('friend_unblock')}
        </Button>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  // Equal parts of the row: they all grow from nothing, so three cells are thirds and one is the lot.
  cell: { flexGrow: 1, flexShrink: 1, flexBasis: 0, paddingHorizontal: 8 },
  natural: { minWidth: 140 },
});

export default FriendDetailActions;
