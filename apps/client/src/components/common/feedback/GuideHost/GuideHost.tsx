import { DrawerActions } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Guide, GuideRect } from '../../../../guides/types';
import { measureGuideAnchors, unionGuideRects } from '../../../../guides/anchorRegistry';
import { useGuidePersistence } from '../../../../hooks/useGuidePersistence';
import { useResponsiveLayout } from '../../../../hooks/useResponsiveLayout';
import { getGuideDrawer, scrollDrawerToRect } from '../../../../navigation/drawerGuideRegistry';
import { useGuideStore } from '../../../../state/guideStore';
import { useTheme } from '../../../../theme';

/** Breathing room around the spotlighted target. */
const SPOTLIGHT_PADDING = 8;
/** How far below the drawer's top edge a scrolled-to group lands. */
const DRAWER_SCROLL_MARGIN = 96;
/** Grace for the drawer open/scroll animation before anchors are measured. */
const DRAWER_SETTLE_MS = 400;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Renders the active guided tour (see `state/guideStore`). Mounted once near the app's root
 * (`App.tsx`), the same way as `AppAlertHost`: a single `Modal`, isolated from the rest of the
 * screen tree, so any screen can own a tour without mounting anything locally.
 *
 * The card renders first on every step; the spotlight is an enhancement that appears once the
 * step's anchors are measured. Anything unmeasurable - missing anchors, an unmounted drawer,
 * a failed measure - degrades to the card alone, never a stuck screen. "Skip" is always
 * visible, and finishing or skipping records the tour as seen (the write runs in the
 * background; a failed write only means the tour shows again).
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
  const activeTour = useGuideStore((state) => state.activeTour);
  const nextStep = useGuideStore((state) => state.nextStep);
  const prevStep = useGuideStore((state) => state.prevStep);
  const skipTour = useGuideStore((state) => state.skipTour);
  const completeTour = useGuideStore((state) => state.completeTour);
  const recordSeen = useGuidePersistence();
  const [spot, setSpot] = useState<GuideRect | null>(null);

  const guide: Guide | null = activeTour?.guide ?? null;
  const step = guide && activeTour ? guide.steps[activeTour.stepIndex] : undefined;

  useEffect(() => {
    if (!activeTour || !step) return;
    let cancelled = false;
    setSpot(null);
    const anchors = step.anchors ?? [];
    if (anchors.length === 0) return;
    (async () => {
      if (step.drawerId) {
        const handle = getGuideDrawer(step.drawerId);
        if (!handle) return;
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
    })().catch(() => {
      // Measuring must never break the tour; the card alone is the fallback.
      if (!cancelled) setSpot(null);
    });
    return () => {
      cancelled = true;
    };
  }, [activeTour, step, isWide]);

  if (!guide || !step || !activeTour) {
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

  const styles = StyleSheet.create({
    root: {
      flex: 1,
    },
    dim: {
      position: 'absolute',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    highlight: {
      position: 'absolute',
      borderWidth: 2,
      borderColor: colors.primary,
      borderRadius: 8,
    },
    cardWrap: {
      flex: 1,
      justifyContent: 'flex-end',
      padding: 20,
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
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      gap: 10,
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
      marginTop: 12,
      alignSelf: 'flex-start',
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
        {padded ? (
          <>
            <View
              pointerEvents="none"
              style={[styles.dim, { top: 0, left: 0, right: 0, height: padded.y }]}
            />
            <View
              pointerEvents="none"
              style={[styles.dim, { top: padded.y + padded.height, left: 0, right: 0, bottom: 0 }]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.dim,
                { top: padded.y, left: 0, width: padded.x, height: padded.height },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.dim,
                {
                  top: padded.y,
                  left: padded.x + padded.width,
                  right: 0,
                  height: padded.height,
                },
              ]}
            />
            <View
              pointerEvents="none"
              testID="guide-spotlight"
              style={[
                styles.highlight,
                { left: padded.x, top: padded.y, width: padded.width, height: padded.height },
              ]}
            />
          </>
        ) : (
          <View pointerEvents="none" style={[styles.dim, StyleSheet.absoluteFill]} />
        )}
        <View style={styles.cardWrap} pointerEvents="box-none">
          <View style={styles.card} testID="guide-card">
            <Text style={styles.title}>{t(step.titleKey)}</Text>
            <Text style={styles.message}>{t(step.bodyKey)}</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                testID="guide-skip"
                style={[styles.button, styles.secondaryButton]}
                onPress={handleSkip}
              >
                <Text style={styles.secondaryButtonText}>{t('guide_skip')}</Text>
              </TouchableOpacity>
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
