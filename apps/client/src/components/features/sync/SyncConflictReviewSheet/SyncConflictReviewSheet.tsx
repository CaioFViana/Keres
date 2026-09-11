import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useConflictReviewData } from '../../../../hooks/useConflictReviewData';
import { useSyncConflictActions } from '../../../../hooks/useSyncConflictActions';
import { useSyncConflictStore } from '../../../../state/syncConflictStore';
import { useUserSettingsStore } from '../../../../state/userSettingsStore';
import { useTheme } from '../../../../theme';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { AppAlert } from '@/src/utils/AppAlert';
import ConflictDetailSheet from '../ConflictDetailSheet/ConflictDetailSheet';
import ConflictFieldDiffSheet from '../ConflictFieldDiffSheet/ConflictFieldDiffSheet';
import ConflictRow from './ConflictRow';

interface SyncConflictReviewSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * The review surface for the pending conflicts - opened by `SyncConflictBanner`, never
 * on its own. Relations (characters, tags, notes, locations, galleries, scenes, items, "see
 * also") go to a section resolvable in one tap, always with names already resolved, never
 * raw IDs. Real content conflicts (Character, Chapter, Scene...) only open the field-by-field
 * comparison when there really are multiple genuinely disputed fields.
 */
const SyncConflictReviewSheet: React.FC<SyncConflictReviewSheetProps> = ({ visible, onClose }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const conflicts = useSyncConflictStore((state) => state.conflicts);
  const { isResolving, keepLocal, keepServer, keepServerAndCloneBoard } = useSyncConflictActions();
  const userId = useUserSettingsStore((state) => state.userId);
  const selectedConflictId = useSyncConflictStore((state) => state.selectedConflictId);
  const selectConflict = useSyncConflictStore((state) => state.selectConflict);
  const clearSelection = useSyncConflictStore((state) => state.clearSelection);
  const { summaries } = useConflictReviewData(conflicts);
  const [detailConflictId, setDetailConflictId] = useState<string | null>(null);

  const sections = useMemo(() => {
    const relations = summaries.filter((summary) => summary.kind === 'relation');
    const content = summaries.filter((summary) => summary.kind === 'content');
    return [
      { title: t('conflict_section_relations'), data: relations },
      { title: t('conflict_section_content'), data: content },
    ].filter((section) => section.data.length > 0);
  }, [summaries, t]);

  const selectedConflict = conflicts.find((conflict) => conflict.id === selectedConflictId);
  const selectedSummary = summaries.find((summary) => summary.id === selectedConflictId);
  const detailConflict = conflicts.find((conflict) => conflict.id === detailConflictId);
  const detailSummary = summaries.find((summary) => summary.id === detailConflictId);

  const resolveKeepMine = useCallback(
    (conflictId: string) => {
      AppAlert.alert(t('conflict_confirm_title'), t('conflict_confirm_keep_mine'), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('conflict_confirm_action'),
          onPress: () => {
            setDetailConflictId(null);
            void keepLocal(conflictId);
          },
        },
      ]);
    },
    [keepLocal, t],
  );

  const resolveKeepServer = useCallback(
    (conflictId: string) => {
      AppAlert.alert(t('conflict_confirm_title'), t('conflict_confirm_keep_server'), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('conflict_confirm_action'),
          style: 'destructive',
          onPress: () => {
            setDetailConflictId(null);
            void keepServer(conflictId);
          },
        },
      ]);
    },
    [keepServer, t],
  );

  const resolveCloneBoard = useCallback(
    (conflictId: string, boardName: string) => {
      if (!userId) return;
      AppAlert.alert(t('conflict_confirm_title'), t('conflict_confirm_clone_board'), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('conflict_confirm_action'),
          onPress: () => {
            setDetailConflictId(null);
            void keepServerAndCloneBoard(
              conflictId,
              userId,
              t('board_copy_name', { name: boardName }),
            );
          },
        },
      ]);
    },
    [keepServerAndCloneBoard, t, userId],
  );

  const styles = StyleSheet.create({
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 24,
      maxHeight: '78%',
    },
    handle: {
      alignSelf: 'center',
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 14,
    },
    header: { flexDirection: 'row', alignItems: 'center' },
    title: { flex: 1, fontSize: 19, fontWeight: 'bold', color: colors.text },
    closeButton: { padding: 4 },
    sectionTitle: {
      fontSize: 13,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 18,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 12,
    },
  });

  return (
    <>
      <ResponsiveModal
        visible={visible}
        onClose={onClose}
        placement="adaptive"
        contentStyle={styles.sheet}
        maxHeight="78%"
      >
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>{t('conflict_review_title')}</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel={t('conflict_close_review')}
          >
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {sections.length === 0 ? (
          <Text style={styles.emptyText}>{t('conflict_review_empty')}</Text>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderSectionHeader={({ section }) => (
              <Text style={styles.sectionTitle}>{section.title}</Text>
            )}
            renderItem={({ item }) => (
              <ConflictRow
                summary={item}
                isResolving={isResolving}
                onKeepMine={() => resolveKeepMine(item.id)}
                onKeepServer={() => resolveKeepServer(item.id)}
                onCloneBoard={
                  item.offerBoardClone && userId
                    ? () => resolveCloneBoard(item.id, item.title)
                    : undefined
                }
                onOpenDetails={() => setDetailConflictId(item.id)}
              />
            )}
          />
        )}
      </ResponsiveModal>

      {detailConflict && detailSummary && (
        <ConflictDetailSheet
          conflict={detailConflict}
          summary={detailSummary}
          visible
          isResolving={isResolving}
          onClose={() => setDetailConflictId(null)}
          onKeepMine={() => resolveKeepMine(detailConflict.id)}
          onKeepServer={() => resolveKeepServer(detailConflict.id)}
          onCloneBoard={
            detailSummary.offerBoardClone && userId
              ? () => resolveCloneBoard(detailConflict.id, detailSummary.title)
              : undefined
          }
          onCompareFields={() => {
            setDetailConflictId(null);
            selectConflict(detailConflict.id);
          }}
        />
      )}

      {selectedConflict && selectedSummary && (
        <ConflictFieldDiffSheet
          conflict={selectedConflict}
          summary={selectedSummary}
          visible
          onClose={clearSelection}
        />
      )}
    </>
  );
};

export default SyncConflictReviewSheet;
