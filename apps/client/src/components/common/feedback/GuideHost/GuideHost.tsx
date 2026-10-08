import { DrawerActions } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { Guide, GuideRect } from '../../../../guides/types';
import { arrowOffset, cardLayout } from '../../../../guides/cardPlacement';
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
const SETTLE_POLL_MS = 50;
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
  const [measuredSpot, setSpot] = useState<GuideRect | null>(null);

  const guide: Guide | null = activeTour?.guide ?? null;
  const step = guide && activeTour ? guide.steps[activeTour.stepIndex] : undefined;

  // Nothing is drawn until the first step knows where its hole goes, and the canvas that draws it
  // can: showing the dim first and the hole after is the flash a person sees when a tour starts.
  // `waited` is the way out when either never comes - the tour then opens with what it has.
  // A step with no anchors has no hole and nothing to measure, so both are read off the step instead of
  // being set from an effect.
  const hasAnchors = (step?.anchors?.length ?? 0) > 0;
  const [measuredOnce, setMeasured] = useState(false);
  const measured = measuredOnce || !hasAnchors;
  const spot = hasAnchors ? measuredSpot : null;
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), REVEAL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  // The hole and the card stay where they are while the next step is measured and then slide straight
  // to it: nothing is reset to a default place in between. The window height is read at that moment.
  const windowHeightRef = useRef(windowSize.height);
  useEffect(() => {
    windowHeightRef.current = windowSize.height;
  }, [windowSize.height]);

  useEffect(() => {
    if (!activeTour || !step) return;
    let cancelled = false;
    const anchors = step.anchors ?? [];
    if (anchors.length === 0) return;
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
        if (cancelled) return;
        // Only a group that is not already in view is scrolled to; one that is, is pointed at now.
        const visible =
          !!target && target.y >= 0 && target.y + target.height <= windowHeightRef.current;
        if (target && !visible) {
          await scrollDrawerToRect(step.drawerId, target, DRAWER_SCROLL_MARGIN);
          if (cancelled) return;
        }
        const settled = visible ? target : await measure();
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

  // Where the card goes for this step, and the card as it is drawn: it slides there from wherever it
  // was, edge or target, together with the hole.
  const targetLayout = cardLayout({
    spot: padded,
    target: padded,
    windowWidth: windowSize.width,
    windowHeight: windowSize.height,
    cardHeight,
    topInset: insets.top,
    bottomInset: insets.bottom,
  });
  // Until the tour is shown the card has no place: it must not start from the default one and slide to
  // the first target the moment it appears.
  const revealed = (measured && canvasReady) || waited;
  const cardRect = useTweenedRect(
    revealed
      ? { x: targetLayout.left, y: targetLayout.top, width: targetLayout.width, height: 1 }
      : null,
  );

  if (!guide || !step || !activeTour || !revealed) {
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

  const layout = {
    ...targetLayout,
    ...(cardRect ? { left: cardRect.x, top: cardRect.y, width: cardRect.width } : null),
    arrowX:
      shownRect && cardRect
        ? arrowOffset(shownRect, cardRect.x, cardRect.width)
        : targetLayout.arrowX,
  };

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
