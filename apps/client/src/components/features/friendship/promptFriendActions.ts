import { AppAlert } from '../../../utils/AppAlert';

export interface FriendAction {
  label: string;
  /** What ends something (remove, block): drawn as the destructive choice. */
  destructive?: boolean;
  onPress: () => void;
}

/**
 * Offers the actions a friendship has besides its main one, in the system's own dialog - the same way the
 * gallery asks what kind of media to add. Each action then asks for its own confirmation, so a slip here
 * costs a tap on "Cancel".
 */
export function promptFriendActions(
  t: (key: string) => string,
  friendName: string,
  actions: readonly FriendAction[],
): void {
  AppAlert.alert(friendName, undefined, [
    ...actions.map((action) => ({
      text: action.label,
      style: action.destructive ? ('destructive' as const) : ('default' as const),
      onPress: action.onPress,
    })),
    { text: t('cancel'), style: 'cancel' },
  ]);
}
