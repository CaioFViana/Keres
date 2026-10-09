import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '@keres/shared';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useTheme } from '../../../theme';
import { getCommonCardStyles } from '../../../theme/commonStyles';
import type { BoardEntitySummary } from '../../../utils/boardEntitySummary';

/** Styles shared by the node sheets of the canvases (board pins and map points). */
export const getCanvasNodeSheetStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 24,
      maxHeight: '78%',
      overflow: 'visible',
    },
    scroll: { flexGrow: 1 },
    scrollContent: { paddingHorizontal: 2, paddingVertical: 2 },
    handle: {
      alignSelf: 'center',
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 14,
    },
    header: { flexDirection: 'row', alignItems: 'flex-start' },
    headerText: { flex: 1, marginRight: 12 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: 19, fontWeight: 'bold', color: colors.text },
    typeLine: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
      textTransform: 'uppercase',
      fontWeight: '600',
    },
    openRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      paddingVertical: 8,
    },
    openText: { color: colors.primary, fontSize: 15, fontWeight: '600', marginLeft: 6 },
    section: {
      fontSize: 13,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 18,
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    cardTitle: { marginBottom: 10 },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 10,
      marginBottom: 6,
      backgroundColor: colors.surface,
    },
    itemText: { flex: 1, color: colors.text, fontSize: 13 },
    hint: { color: colors.textSecondary, fontSize: 13, marginBottom: 10 },
    summaryText: { color: colors.text, fontSize: 13, lineHeight: 19 },
    removeButton: { marginTop: 16, backgroundColor: colors.error },
  });

export interface CanvasNodeSheetProps {
  title: string;
  /** The line under the title, when the node has a type to show. */
  typeLine?: string;
  /** Buttons placed before the close button in the header. */
  headerActions?: React.ReactNode;
  /** Shown between the header and the open row, e.g. a deleted-entity warning. */
  notice?: React.ReactNode;
  /** The row that opens what the node points to, when there is one. */
  open?: { label: string; onPress: () => void };
  onClose: () => void;
  children: React.ReactNode;
}

/** The bottom sheet of a canvas node: header with close, an optional open row, then the body. */
export const CanvasNodeSheet: React.FC<CanvasNodeSheetProps> = ({
  title,
  typeLine,
  headerActions,
  notice,
  open,
  onClose,
  children,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => getCanvasNodeSheetStyles(colors), [colors]);

  return (
    <ResponsiveModal visible onClose={onClose} placement="adaptive" contentStyle={styles.sheet}>
      <View style={styles.handle} />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {typeLine !== undefined && <Text style={styles.typeLine}>{typeLine}</Text>}
        </View>
        <View style={styles.headerActions}>
          {headerActions}
          <TouchableOpacity onPress={onClose} accessibilityLabel={t('close')}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
      {notice}
      {open && (
        <TouchableOpacity style={styles.openRow} onPress={open.onPress}>
          <Ionicons name="open-outline" size={18} color={colors.primary} />
          <Text style={styles.openText}>{open.label}</Text>
        </TouchableOpacity>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </ResponsiveModal>
  );
};

/** The entity's description inside a node sheet, or n/a when it has none. */
export const CanvasEntitySummaryCard: React.FC<{
  title: string;
  summary: BoardEntitySummary;
}> = ({ title, summary }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const cardStyles = useMemo(() => getCommonCardStyles(colors), [colors]);
  const styles = useMemo(() => getCanvasNodeSheetStyles(colors), [colors]);
  return (
    <View style={cardStyles.cardContainer}>
      <Text style={[cardStyles.cardText, styles.cardTitle]}>{title}</Text>
      {summary.details ? (
        <Text style={styles.summaryText}>{summary.details}</Text>
      ) : (
        <Text style={styles.hint}>{t('common_na')}</Text>
      )}
    </View>
  );
};
