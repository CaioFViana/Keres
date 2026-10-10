import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { type ThemeColors, useTheme } from '../../../theme';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import type { ClientFlavor } from '../../../utils/clientFlavor';
import WelcomeHero from './WelcomeHero';
import {
  WELCOME_TITLE_KEYS,
  welcomeHeroIcon,
  welcomeRows,
  type WelcomePageId,
} from './welcomeContent';

/** Stacked: the picture over the text, for narrow screens. Split: the two side by side, for wide ones. */
export type WelcomeLayout = 'stacked' | 'split';

/** Where the text starts in a split page: the picture takes this share of the width, and a gap. */
const SPLIT_PICTURE_SHARE = 0.46;
const SPLIT_GAP = 48;

interface WelcomePageViewProps {
  page: WelcomePageId;
  flavor: ClientFlavor;
  layout: WelcomeLayout;
  /** Where this page sits in the pager, and how far the pager has scrolled. */
  index: number;
  scrollX: SharedValue<number>;
  pageWidth: number;
  /** Whether this is the page on screen: the others are present for the swipe, and stay out of reach. */
  active: boolean;
  /** A line above the title, for the first page. */
  eyebrow?: string;
  /** What goes under the rows, such as the form of the last page. */
  children?: React.ReactNode;
}

/**
 * One step of the first-run welcome: the picture, a title, and a few short rows each led by an icon
 * badge. The text drifts and fades with the swipe, a little behind the page.
 */
const WelcomePageView: React.FC<WelcomePageViewProps> = ({
  page,
  flavor,
  layout,
  index,
  scrollX,
  pageWidth,
  active,
  eyebrow,
  children,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const split = layout === 'split';
  const pictureWidth = split ? Math.round(pageWidth * SPLIT_PICTURE_SHARE) : pageWidth;
  const styles = useThemedStyles(createStyles, [split, pageWidth]);

  const bodyStyle = useAnimatedStyle(() => {
    const distance = (scrollX.value - index * pageWidth) / pageWidth;
    return {
      opacity: interpolate(Math.abs(distance), [0, 0.7], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateX: distance * -pageWidth * 0.15 }],
    };
  });

  return (
    <View
      style={styles.page}
      testID={`welcome-page-${page}`}
      pointerEvents={active ? 'auto' : 'none'}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
    >
      <WelcomeHero
        icon={welcomeHeroIcon(page, flavor)}
        index={index}
        scrollX={scrollX}
        pageWidth={pageWidth}
        width={pictureWidth}
        size={split ? 'large' : 'regular'}
        entrance={index === 0}
      />
      <Animated.View
        style={[styles.body, bodyStyle]}
        entering={index === 0 ? FadeInDown.duration(480).delay(180) : undefined}
      >
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{t(WELCOME_TITLE_KEYS[page])}</Text>
        {welcomeRows(page, flavor).map((row) => (
          <View key={row.textKey} style={styles.row}>
            <View style={styles.badge}>
              <Ionicons name={row.icon} size={split ? 24 : 20} color={colors.onPrimaryContainer} />
            </View>
            <Text style={styles.text}>{t(row.textKey)}</Text>
          </View>
        ))}
        {children}
      </Animated.View>
    </View>
  );
};

const createStyles = (colors: ThemeColors, [split, pageWidth]: [boolean, number]) =>
  StyleSheet.create({
    page: { width: pageWidth, flexDirection: split ? 'row' : 'column', alignItems: 'center' },
    body: split
      ? { flex: 1, marginLeft: SPLIT_GAP, paddingRight: 8 }
      : { width: '100%', paddingTop: 22, paddingHorizontal: 4 },
    eyebrow: {
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.primary,
      marginBottom: 6,
    },
    title: {
      fontSize: split ? 36 : 28,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: split ? 24 : 18,
    },
    row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: split ? 20 : 16 },
    badge: {
      width: split ? 44 : 38,
      height: split ? 44 : 38,
      borderRadius: split ? 22 : 19,
      marginRight: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryContainer,
    },
    text: { flex: 1, fontSize: split ? 18 : 16, lineHeight: split ? 28 : 24, color: colors.text },
  });

export default WelcomePageView;
