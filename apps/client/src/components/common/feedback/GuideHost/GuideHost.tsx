import { DrawerActions } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import type { Guide, GuideRect } from '../../../../guides/types';
import { cardPlacement } from '../../../../guides/cardPlacement';
import GuideSpotlight from './GuideSpotlight';
import { measureGuideAnchors, unionGuideRects } from '../../../../guides/anchorRegistry';
import { useCanvasKitReady } from '../../../features/graphs/SkiaEdgeCanvas/useCanvasKitReady';
import { useGuidePersistence } from '../../../../hooks/useGuidePersistence';
import { useResponsiveLayout } from '../../../../hooks/useResponsiveLayout';
import { useSystemInsets } from '../../../../hooks/useSystemInsets';
import { getGuideDrawer, scrollDrawerToRect } from '../../../../navigation/drawerGuideRegistry';
import { useGuideStore } from '../../../../state/guideStore';
import { useTheme } from '../../../../theme';

/** Breathing room around the spotlighted target. */
const SPOTLIGHT_PADDING = 8;
/** How far below the drawer's top edge a scrolled-to group lands. */
const DRAWER_SCROLL_MARGIN = 96;
/** Grace for the drawer open/scroll animation before anchors are measured. */
const DRAWER_SETTLE_MS = 400;

/** The longest a tour waits to know where its first hole goes (and for the canvas) before opening. */
const REVEAL_TIMEOUT_MS = 1500;

/** What the card is guessed to measure before its first layout, so it is placed right from the start. */
const DEFAULT_CARD_HEIGHT = 230;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Renders the active guided tour (see `state/guideStore`). Mounted once near the app's root
 * (`App.tsx`), the same way as `AppAlertHost`: a single `Modal`, isolated from the rest of the
 * screen tree, so any screen can own a tour without mounting anything locally.
 *
 * The card renders first on every step; the spotlight is an enhancement that appears once the
 * step's anchors are measured. Anything unmeasurable - missing anchors, an unmounted drawer,
 * a failed measure - degrades to the card alone, never a stuck screen. "Skip" and "later"
 * are always visible: finishing or skipping records the tour as seen (the write runs in
 * the background; a failed write only means the tour shows again), while "later" only
 * closes the card for this focus.
 *
 * The shell below subscribes to the store and nothing else, so the idle host costs one
 * selector; everything UI-bound (theme, i18n, drizzle) lives in the overlay, which only
 * mounts while a tour plays.
 */
const GuideHost: React.FC = () => {
  const activeTour = useGuideStore((state) => state.activeTour);
  if (!activeTour) return null;
  return <ActiveGuideOverlay />;
};

const ActiveGuideOverlay: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { isWide } = useResponsiveLayout();
  const insets = useSystemInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [cardHeight, setCardHeight] = useState(DEFAULT_CARD_HEIGHT);
  const activeTour = useGuideStore((state) => state.activeTour);
  const nextStep = useGuideStore((state) => state.nextStep);
  const prevStep = useGuideStore((state) => state.prevStep);
  const skipTour = useGuideStore((state) => state.skipTour);
  const completeTour = useGuideStore((state) => state.completeTour);
  const snoozeTour = useGuideStore((state) => state.snoozeTour);
  const recordSeen = useGuidePersistence();
  const canvasReady = useCanvasKitReady();
  const [spot, setSpot] = useState<GuideRect | null>(null);

  const guide: Guide | null = activeTour?.guide ?? null;
  const step = guide && activeTour ? guide.steps[activeTour.stepIndex] : undefined;

  // Nothing is drawn until the first step knows where its hole goes, and the canvas that draws it
  // can: showing the dim first and the hole after is the flash a person sees when a tour starts.
  // `waited` is the way out when either never comes - the tour then opens with what it has.
  const [measured, setMeasured] = useState(() => (step?.anchors?.length ?? 0) === 0);
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), REVEAL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  const [prevActiveTour, setPrevActiveTour] = useState(activeTour);
  const [prevGuideStep, setPrevGuideStep] = useState(step);
  const [prevIsWide, setPrevIsWide] = useState(isWide);
  if (activeTour !== prevActiveTour || step !== prevGuideStep || isWide !== prevIsWide) {
    setPrevActiveTour(activeTour);
    setPrevGuideStep(step);
    setPrevIsWide(isWide);
    // A step that is quick to measure keeps the hole it had until its own arrives, so the dim never
    // closes over the screen between two steps; one that waits on the drawer, or has no target,
    // starts without a hole.
    if (activeTour && step && (step.drawerId || (step.anchors?.length ?? 0) === 0)) {
      setSpot(null);
    }
  }

  useEffect(() => {
    if (!activeTour || !step) return;
    let cancelled = false;
    const anchors = step.anchors ?? [];
    if (anchors.length === 0) {
      setMeasured(true);
      return;
    }
    (async () => {
      if (step.drawerId) {
        const handle = getGuideDrawer(step.drawerId);
        if (!handle) {
          setMeasured(true);
          return;
        }
        // Opening an already-open drawer is a no-op router-side; permanent drawers need no open.
        if (!isWide) handle.navigation.dispatch(DrawerActions.openDrawer());
        const target = unionGuideRects(await measureGuideAnchors(anchors));
        if (target) {
          await scrollDrawerToRect(step.drawerId, target, DRAWER_SCROLL_MARGIN);
          await delay(DRAWER_SETTLE_MS);
        }
        if (cancelled) return;
      }
      if (cancelled) return;
      setSpot(unionGuideRects(await measureGuideAnchors(anchors)));
      setMeasured(true);
    })().catch(() => {
      // Measuring must never break the tour; the card alone is the fallback.
      if (!cancelled) {
        setSpot(null);
        setMeasured(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeTour, step, isWide]);

  if (!guide || !step || !activeTour || !((measured && canvasReady) || waited)) {
    return null;
  }

  const isFirst = activeTour.stepIndex <= 0;
  const isLast = activeTour.stepIndex >= guide.steps.length - 1;
  const drawerHandle = getGuideDrawer(guide.drawerId);
  const canShowHelp = Boolean(guide.helpPageId && drawerHandle);

  const handleSkip = () => {
    skipTour();
    recordSeen(guide.id);
  };

  const handleFinish = () => {
    completeTour();
    recordSeen(guide.id);
  };

  const handleSnooze = () => {
    // "Later" closes the card without recording: the tour opens on the next visit.
    snoozeTour();
  };

  const handleHelp = () => {
    if (!guide.helpPageId || !drawerHandle) return;
    let returnDrawerRoute: string | undefined;
    try {
      const drawerState = drawerHandle.navigation.getState();
      returnDrawerRoute = drawerState?.routes[drawerState.index ?? 0]?.name;
    } catch {
      returnDrawerRoute = undefined;
    }
    drawerHandle.navigation.navigate('HelpDrawer', {
      screen: 'HelpPage',
      params: { pageId: guide.helpPageId, returnDrawerRoute },
    });
    // The user chose the manual over the tour; leaving mid-tour counts as skipping it.
    handleSkip();
  };

  const padded = spot
    ? {
        x: Math.max(0, spot.x - SPOTLIGHT_PADDING),
        y: Math.max(0, spot.y - SPOTLIGHT_PADDING),
        width: spot.width + SPOTLIGHT_PADDING * 2,
        height: spot.height + SPOTLIGHT_PADDING * 2,
      }
    : null;

  // The card gives way to what it explains: at the top when the bottom would cover the target.
  const placement = cardPlacement({
    spot: padded,
    windowHeight,
    cardHeight,
    topInset: insets.top,
    bottomInset: insets.bottom,
  });

  const styles = StyleSheet.create({
    root: {
      flex: 1,
    },
    // The card sits at the foot of a window the navigation bar draws over: its last row (the help
    // link) needs room above the bar, not against it.
    cardWrap: {
      flex: 1,
      justifyContent: placement === 'top' ? 'flex-start' : 'flex-end',
      padding: 20,
      paddingTop: 20 + (placement === 'top' ? insets.top : 0),
      paddingBottom: 20 + insets.bottom,
    },
    card: {
      width: '100%',
      maxWidth: 480,
      alignSelf: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      elevation: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 4.65,
    },
    title: {
      fontSize: 17,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    message: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 16,
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 10,
    },
    tertiaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    primaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 10,
    },
    tertiaryButton: {
      paddingVertical: 10,
      paddingHorizontal: 8,
    },
    tertiaryButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '600',
    },
    button: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      minWidth: 72,
      alignItems: 'center',
    },
    primaryButton: {
      backgroundColor: colors.primary,
    },
    secondaryButton: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    primaryButtonText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: 'bold',
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: 'bold',
    },
    helpLink: {
      marginTop: 4,
      alignSelf: 'flex-start',
      paddingVertical: 8,
      paddingRight: 8,
    },
    helpLinkText: {
      color: colors.primary,
      fontSize: 14,
      textDecorationLine: 'underline',
    },
  });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleSkip}>
      <View style={styles.root}>
        {/* Eats every touch outside the card; the visuals below it are pointer-transparent. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={() => {}} />
        <GuideSpotlight rect={padded} borderColor={colors.primary} />
        <View testID="guide-card-wrap" style={styles.cardWrap} pointerEvents="box-none">
          <View
            style={styles.card}
            testID="guide-card"
            onLayout={(event) => {
              const next = Math.round(event.nativeEvent.layout.height);
              if (next > 0 && next !== cardHeight) setCardHeight(next);
            }}
          >
            <Text style={styles.title}>{t(step.titleKey)}</Text>
            <Text style={styles.message}>{t(step.bodyKey)}</Text>
            <View style={styles.buttonRow}>
              <View style={styles.tertiaryRow}>
                <TouchableOpacity
                  testID="guide-skip"
                  style={styles.tertiaryButton}
                  onPress={handleSkip}
                >
                  <Text style={styles.tertiaryButtonText}>{t('guide_skip')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="guide-snooze"
                  style={styles.tertiaryButton}
                  onPress={handleSnooze}
                >
                  <Text style={styles.tertiaryButtonText}>{t('tour_snooze')}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.primaryRow}>
                {!isFirst && (
                  <TouchableOpacity
                    testID="guide-prev"
                    style={[styles.button, styles.secondaryButton]}
                    onPress={prevStep}
                  >
                    <Text style={styles.secondaryButtonText}>{t('guide_back')}</Text>
                  </TouchableOpacity>
                )}
                {isLast ? (
                  <TouchableOpacity
                    testID="guide-finish"
                    style={[styles.button, styles.primaryButton]}
                    onPress={handleFinish}
                  >
                    <Text style={styles.primaryButtonText}>{t('guide_finish')}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    testID="guide-next"
                    style={[styles.button, styles.primaryButton]}
                    onPress={nextStep}
                  >
                    <Text style={styles.primaryButtonText}>{t('guide_next')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {canShowHelp && (
              <TouchableOpacity testID="guide-help" style={styles.helpLink} onPress={handleHelp}>
                <Text style={styles.helpLinkText}>{t('guide_open_help')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default GuideHost;
