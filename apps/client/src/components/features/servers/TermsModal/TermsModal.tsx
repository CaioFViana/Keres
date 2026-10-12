import Button from '@/src/components/common/controls/Button/Button';
import ModalHeader from '@/src/components/layout/ModalHeader/ModalHeader';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useTheme } from '@/src/theme';
import { space, typography } from '@/src/theme/tokens';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export interface TermsSection {
  heading: string;
  paragraphs: string[];
}

interface TermsModalProps {
  visible: boolean;
  title: string;
  /** e.g. the version and date of the text on show. */
  subtitle?: string;
  sections: TermsSection[];
  /** `read` only shows the text; `accept` adds an agree button. */
  mode: 'read' | 'accept';
  acceptLabel?: string;
  onAccept?: () => void;
  onClose: () => void;
  /** The agree button stays disabled until the end is scrolled into view. */
  requireScrollToEnd?: boolean;
  testID?: string;
}

/** How close to the bottom counts as having read to the end, in pixels. */
const END_THRESHOLD = 24;

/**
 * Terms of service, app or server, on a fullscreen-capable surface with the shared header
 * and close button. Acceptance mode optionally refuses agreement until the text was scrolled
 * to the end; text short enough to fit without scrolling agrees at once.
 */
const TermsModal: React.FC<TermsModalProps> = ({
  visible,
  title,
  subtitle,
  sections,
  mode,
  acceptLabel,
  onAccept,
  onClose,
  requireScrollToEnd = false,
  testID = 'terms-modal',
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [reachedEnd, setReachedEnd] = useState(false);
  // What the scroll view measured: the end is only "reached" when the content is shorter than the window (it all fits)
  // or the person scrolled to it. Unmeasured is not evidence of either.
  const measured = useRef({ content: 0, layout: 0 });

  const handleScroll = useCallback(
    (contentHeight: number, layoutHeight: number, offsetY: number) => {
      // Unmeasured layouts (zero heights, as in tests) open nothing: the gate only answers
      // real evidence, and content short enough to fit opens on its first real measure.
      if (contentHeight <= 0) return;
      if (contentHeight - layoutHeight - offsetY <= END_THRESHOLD) setReachedEnd(true);
    },
    [],
  );

  const canAccept = !requireScrollToEnd || reachedEnd;

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      inset="regular"
      tone="raised"
      maxHeight="92%"
      keyboardAvoiding={false}
    >
      <ModalHeader
        title={title}
        subtitle={subtitle}
        onClose={onClose}
        bordered
        closeTestID={`${testID}-close`}
      />
      <ScrollView
        testID={`${testID}-scroll`}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onScroll={(event) => {
          const { contentSize, layoutMeasurement, contentOffset } = event.nativeEvent;
          handleScroll(contentSize.height, layoutMeasurement.height, contentOffset.y);
        }}
        onLayout={(event) => {
          measured.current.layout = event.nativeEvent.layout.height;
          if (measured.current.layout > 0)
            handleScroll(measured.current.content, measured.current.layout, 0);
        }}
        onContentSizeChange={(width, height) => {
          measured.current.content = height;
          if (measured.current.layout > 0) handleScroll(height, measured.current.layout, 0);
        }}
        scrollEventThrottle={100}
      >
        {sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={[typography.sectionTitle, { color: colors.text }]}>{section.heading}</Text>
            {section.paragraphs.map((paragraph, index) => (
              <Text
                key={`${section.heading}-${index}`}
                style={[typography.body, { color: colors.text }]}
              >
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
      {mode === 'accept' ? (
        <View style={styles.footer}>
          {requireScrollToEnd && !reachedEnd ? (
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              {t('terms_scroll_to_accept')}
            </Text>
          ) : null}
          <Button onPress={() => onAccept?.()} disabled={!canAccept} testID={`${testID}-accept`}>
            {acceptLabel ?? t('terms_accept')}
          </Button>
        </View>
      ) : null}
    </ResponsiveModal>
  );
};

const styles = StyleSheet.create({
  scroll: { flexShrink: 1 },
  scrollContent: { gap: space.lg, padding: space.xl },
  section: { gap: space.sm },
  footer: { gap: space.sm, padding: space.xl, paddingTop: space.md },
});

export default TermsModal;
