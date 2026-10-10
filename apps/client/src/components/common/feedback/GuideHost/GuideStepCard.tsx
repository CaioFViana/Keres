import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { CardLayout } from '../../../../guides/cardPlacement';
import { useTheme } from '../../../../theme';

interface GuideStepCardProps {
  layout: CardLayout;
  title: string;
  message: string;
  /** Zero-based place of this step in the tour, and how many steps it has. */
  index: number;
  total: number;
  canShowHelp: boolean;
  onSkip: () => void;
  onSnooze: () => void;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
  onHelp: () => void;
  onHeight: (height: number) => void;
}

/** The side of the arrow that points to the target, as the two borders of a turned square. */
const ARROW = 16;

/**
 * One step of a tour, drawn as a balloon: it sits against the target it explains with an arrow
 * toward it (or rests on an edge of the window when the target is too large for that), says where
 * the person is in the tour, and always offers Skip and Later.
 */
const GuideStepCard: React.FC<GuideStepCardProps> = ({
  layout,
  title,
  message,
  index,
  total,
  canShowHelp,
  onSkip,
  onSnooze,
  onPrev,
  onNext,
  onFinish,
  onHelp,
  onHeight,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const isFirst = index <= 0;
  const isLast = index >= total - 1;
  const pointsDown = layout.mode === 'above';
  const pointsUp = layout.mode === 'below';

  return (
    <View
      testID="guide-card-wrap"
      pointerEvents="box-none"
      style={[styles.wrap, { left: layout.left, width: layout.width }, { top: layout.top }]}
    >
      <View
        testID="guide-card"
        onLayout={(event) => onHeight(Math.round(event.nativeEvent.layout.height))}
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        {(pointsUp || pointsDown) && layout.arrowX !== undefined ? (
          <View
            testID="guide-arrow"
            pointerEvents="none"
            style={[
              styles.arrow,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                left: layout.arrowX - ARROW / 2,
              },
              pointsUp
                ? { top: -ARROW / 2 - 1, borderLeftWidth: 1, borderTopWidth: 1 }
                : { bottom: -ARROW / 2 - 1, borderRightWidth: 1, borderBottomWidth: 1 },
            ]}
          />
        ) : null}
        {total > 1 ? (
          <View style={styles.progress} testID="guide-progress">
            <View style={styles.dots}>
              {Array.from({ length: total }, (_, position) => (
                <View
                  // biome-ignore lint/suspicious/noArrayIndexKey: the dots are positions, nothing else.
                  key={position}
                  style={[
                    styles.dot,
                    { backgroundColor: position === index ? colors.primary : colors.border },
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.count, { color: colors.textSecondary }]}>
              {t('guide_progress', { current: index + 1, total })}
            </Text>
          </View>
        ) : null}
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
        <View style={styles.buttonRow}>
          <View style={styles.tertiaryRow}>
            <TouchableOpacity testID="guide-skip" style={styles.tertiaryButton} onPress={onSkip}>
              <Text style={[styles.tertiaryText, { color: colors.primary }]}>
                {t('guide_skip')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="guide-snooze"
              style={styles.tertiaryButton}
              onPress={onSnooze}
            >
              <Text style={[styles.tertiaryText, { color: colors.primary }]}>
                {t('tour_snooze')}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.primaryRow}>
            {!isFirst && (
              <TouchableOpacity
                testID="guide-prev"
                style={[
                  styles.button,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    borderWidth: 1,
                  },
                ]}
                onPress={onPrev}
              >
                <Text style={[styles.buttonText, { color: colors.text }]}>{t('guide_back')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              testID={isLast ? 'guide-finish' : 'guide-next'}
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={isLast ? onFinish : onNext}
            >
              <Text style={[styles.buttonText, { color: colors.onPrimary }]}>
                {t(isLast ? 'guide_finish' : 'guide_next')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        {canShowHelp && (
          <TouchableOpacity testID="guide-help" style={styles.helpLink} onPress={onHelp}>
            <Text style={[styles.helpLinkText, { color: colors.primary }]}>
              {t('guide_open_help')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    elevation: 6,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  arrow: {
    height: ARROW,
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    width: ARROW,
  },
  progress: { alignItems: 'center', flexDirection: 'row', gap: 10, marginBottom: 10 },
  dots: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  dot: { borderRadius: 4, height: 8, width: 8 },
  count: { fontSize: 12, fontWeight: '600' },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  message: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  buttonRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  tertiaryRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  primaryRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tertiaryButton: { paddingHorizontal: 8, paddingVertical: 10 },
  tertiaryText: { fontSize: 14, fontWeight: '600' },
  button: {
    alignItems: 'center',
    borderRadius: 8,
    minWidth: 72,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonText: { fontSize: 15, fontWeight: 'bold' },
  helpLink: { alignSelf: 'flex-start', marginTop: 4, paddingRight: 8, paddingVertical: 8 },
  helpLinkText: { fontSize: 14, textDecorationLine: 'underline' },
});

export default GuideStepCard;
