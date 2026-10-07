import { DrawerActions } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { Guide, GuideRect } from '../../../../guides/types';
import { cardLayout } from '../../../../guides/cardPlacement';
import { useTweenedRect } from '../../../../guides/useTweenedRect';
import GuideSpotlight from './GuideSpotlight';
import GuideStepCard from './GuideStepCard';
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
/** How often anchors are measured while waiting for them to hold still, and for how long at most. */
const SETTLE_POLL_MS = 120;
const SETTLE_TIMEOUT_MS = 2000;

/** The longest a tour waits to know where its first hole goes (and for the canvas) before opening. */
const REVEAL_TIMEOUT_MS = 1500;

/** What the card is guessed to measure before its first layout, so it is placed right from the start. */
const DEFAULT_CARD_HEIGHT = 230;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const sameRect = (a: GuideRect | null, b: GuideRect | null) =>
  a === b ||
  (!!a &&
    !!b &&
    Math.abs(a.x - b.x) < 1 &&
    Math.abs(a.y - b.y) < 1 &&
    Math.abs(a.width - b.width) < 1 &&
    Math.abs(a.height - b.height) < 1);

/**
 * Where the anchors are once they hold still: measured every so often until two measurements agree
 * (a drawer sliding in, a list scrolling into place and a section laying out all take as long as they
 * take, on every device), or until a timeout, when the last one stands.
 */
async function measureSettled(
  anchors: readonly string[],
  isCancelled: () => boolean,
): Promise<GuideRect | null> {
  let previous = unionGuideRects(await measureGuideAnchors(anchors));
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  while (!isCancelled() && Date.now() < deadline) {
    await delay(SETTLE_POLL_MS);
    const next = unionGuideRects(await measureGuideAnchors(anchors));
    if (sameRect(previous, next)) return next;
    previous = next;
  }
  return previous;
}

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
  const windowSize = useWindowDimensions();
  const [cardHeight, setCardHeight] = useState(DEFAULT_CARD_HEIGHT);
  const activeTour = useGuideStore((state) => state.activeTour);
  const nextStep = useGuideStore((state) => state.nextStep);
  const prevStep = useGuideStore((state) => state.prevStep);
  const skipTour = useGuideStore((state) => state.skipTour);
  const completeTour = useGuideStore((state) => state.completeTour);
  const snoozeTour = useGuideStore((state) => state.snoozeTour);
  const recordSeen = useGuidePersistence();
  // The drawer a step opened, so leaving the tour puts it back instead of leaving the menu open.
  const openedDrawer = useRef<ReturnType<typeof getGuideDrawer>>(undefined);
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
      const measure = () => measureSettled(anchors, () => cancelled);
      if (step.drawerId) {
        const handle = getGuideDrawer(step.drawerId);
        if (!handle) {
          setMeasured(true);
          return;
        }
        // Opening an already-open drawer is a no-op router-side; permanent drawers need no open.
        if (!isWide) {
          handle.navigation.dispatch(DrawerActions.openDrawer());
          openedDrawer.current = handle;
        }
        // The drawer slides in, then the group slides into view: each is measured where it comes to
        // rest, not at a guessed time after it starts.
        const target = await measure();
        if (target) {
          await scrollDrawerToRect(step.drawerId, target, DRAWER_SCROLL_MARGIN);
        }
        if (cancelled) return;
        const settled = await measure();
        if (cancelled) return;
        setSpot(settled);
        setMeasured(true);
        return;
      }
      // A screen step shows its hole as soon as it is measured, then measures again until it holds
      // still: a screen that is still loading lays out a moment later, and the hole grows to cover it.
      setSpot(unionGuideRects(await measureGuideAnchors(anchors)));
      setMeasured(true);
      const settled = await measure();
      if (!cancelled) setSpot(settled);
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

  // The hole as it should be, and as it is drawn: it slides from one step's target to the next, and the
  // card follows it.
  const padded = spot
    ? {
        x: Math.max(0, spot.x - SPOTLIGHT_PADDING),
        y: Math.max(0, spot.y - SPOTLIGHT_PADDING),
        width: spot.width + SPOTLIGHT_PADDING * 2,
        height: spot.height + SPOTLIGHT_PADDING * 2,
      }
    : null;
  const shownRect = useTweenedRect(padded);

  if (!guide || !step || !activeTour || !((measured && canvasReady) || waited)) {
    return null;
  }

  const drawerHandle = getGuideDrawer(guide.drawerId);
  const canShowHelp = Boolean(guide.helpPageId && drawerHandle);

  const closeOpenedDrawer = () => {
    openedDrawer.current?.navigation.dispatch(DrawerActions.closeDrawer());
    openedDrawer.current = undefined;
  };

  const handleSkip = () => {
    closeOpenedDrawer();
    skipTour();
    recordSeen(guide.id);
  };

  const handleFinish = () => {
    closeOpenedDrawer();
    completeTour();
    recordSeen(guide.id);
  };

  const handleSnooze = () => {
    closeOpenedDrawer();
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

  const { width: windowWidth } = windowSize;
  const layout = cardLayout({
    spot: shownRect,
    target: padded,
    windowWidth,
    windowHeight: windowSize.height,
    cardHeight,
    topInset: insets.top,
    bottomInset: insets.bottom,
  });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleSkip}>
      <View style={styles.root}>
        {/* Eats every touch outside the card; the visuals below it are pointer-transparent. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={() => {}} />
        <GuideSpotlight rect={shownRect} borderColor={colors.primary} />
        <GuideStepCard
          layout={layout}
          title={t(step.titleKey)}
          message={t(step.bodyKey)}
          index={activeTour.stepIndex}
          total={guide.steps.length}
          canShowHelp={canShowHelp}
          onSkip={handleSkip}
          onSnooze={handleSnooze}
          onPrev={prevStep}
          onNext={nextStep}
          onFinish={handleFinish}
          onHelp={handleHelp}
          onHeight={(height) => height > 0 && height !== cardHeight && setCardHeight(height)}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({ root: { flex: 1 } });

export default GuideHost;
