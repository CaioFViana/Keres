import { Modal, Platform, StyleSheet, View } from 'react-native';
import { useGalleryMediaViewerStore } from '../../../../state/galleryMediaViewerStore';
import { useNotificationStore } from '../../../../state/notificationStore';
import { usePresenceMatrixViewerStore } from '../../../../state/presenceMatrixViewerStore';
import { useShippedPacksInstallerStore } from '../../../../state/shippedPacksInstallerStore';
import NotificationLanes from '../NotificationLanes/NotificationLanes';

const NotificationPopup = () => {
  const { currentNotifications } = useNotificationStore();
  // A fullscreen overlay draws the lanes itself, as ordinary children of its own Modal - on iOS
  // a second root-level Modal cannot present while another one is open (shared presenter), so
  // the root host standing down is what keeps exactly one toast visible instead of two, or none.
  // (A toast mid-flight re-slides when its host switches - a remount, same content and lane.)
  // One subscription per line: hooks must all run on every render, and `||` would
  // short-circuit the calls.
  const galleryOpen = useGalleryMediaViewerStore((state) => state.galleryId !== null);
  const presenceOpen = usePresenceMatrixViewerStore((state) => state.request !== null);
  const installerOpen = useShippedPacksInstallerStore((state) => state.open);
  const fullscreenOverlayOpen = galleryOpen || presenceOpen || installerOpen;

  if (fullscreenOverlayOpen) return null;

  // On web the DOM stacking already favors this host (and a fixed overlay div would swallow
  // clicks - `box-none` is not valid CSS, so the browser would drop the passthrough), so the
  // plain view stays. Everywhere else the toasts ride a transparent passthrough Modal of their
  // own: a fullscreen native `Modal` (an alert, a guided tour...) lives in its own native layer
  // above the whole React tree, where no zIndex can reach.
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <NotificationLanes />
      </View>
    );
  }

  // The layer only exists while a lane is occupied, and `box-none` lets every touch outside
  // the items fall through to the app beneath. Two honest trade-offs: a toast already on
  // screen stays under a Modal opened after it (it fades within seconds), and Android's back
  // button is swallowed while a toast is visible (`onRequestClose` has nothing to close).
  return (
    <Modal
      visible={currentNotifications.some((notification) => notification !== null)}
      transparent
      animationType="none"
      onRequestClose={() => {}}
      testID="notification-modal"
    >
      <View style={styles.modalContainer} pointerEvents="box-none" testID="notification-lanes">
        <NotificationLanes />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    // We don't want to set a height here, it should be determined by its children
    // but we need to ensure it's positioned correctly over other content.
    zIndex: 1000,
    alignItems: 'flex-end', // Align notifications to the right
  },
  modalContainer: {
    flex: 1,
  },
});

export default NotificationPopup;
