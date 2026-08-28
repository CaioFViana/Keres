import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '../../../../db';
import {
  buildConflictSummaries,
  collectConflictEntityRefs,
  collectEntityRefs,
} from '../../../../services/ConflictSummaryService';
import {
  createEntityNameBatchResolver,
  createEntitySnapshotResolver,
} from '../../../../services/EntityNameBatchResolver';
import { useSyncConflictStore } from '../../../../state/syncConflictStore';
import { useUserSettingsStore } from '../../../../state/userSettingsStore';
import { useTheme } from '../../../../theme';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
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
  const db = useDrizzle();

  const conflicts = useSyncConflictStore((state) => state.conflicts);
  const isResolving = useSyncConflictStore((state) => state.isResolving);
  const keepLocal = useSyncConflictStore((state) => state.keepLocal);
  const keepServer = useSyncConflictStore((state) => state.keepServer);
  const keepServerAndCloneBoard = useSyncConflictStore((state) => state.keepServerAndCloneBoard);
  const userId = useUserSettingsStore((state) => state.userId);
  const selectedConflictId = useSyncConflictStore((state) => state.selectedConflictId);
  const selectConflict = useSyncConflictStore((state) => state.selectConflict);
  const clearSelection = useSyncConflictStore((state) => state.clearSelection);

  const [snapshots, setSnapshots] = useState<Map<string, Record<string, any>>>(new Map());
  const [names, setNames] = useState<Map<string, string>>(new Map());

  // Two phases: first each conflict's own local row (it fills in what
  // `deleted_on_server` leaves missing in `localValues`/`serverValues` - the name of a content
  // entity, or a relation's IDs), and only then is it possible to know which other entities
  // (the characters of a `CharacterRelation`, for instance) need their name resolved.
  useEffect(() => {
    let cancelled = false;
    const snapshotRefs = collectConflictEntityRefs(conflicts);
    if (snapshotRefs.length === 0) {
      setSnapshots(new Map());
      setNames(new Map());
      return;
    }
    (async () => {
      const resolvedSnapshots = await createEntitySnapshotResolver(db).resolveMany(snapshotRefs);
      if (cancelled) return;
      setSnapshots(resolvedSnapshots);

      const nameRefs = collectEntityRefs(conflicts, resolvedSnapshots);
      if (nameRefs.length === 0) {
        setNames(new Map());
        return;
      }
      const resolvedNames = await createEntityNameBatchResolver(db).resolveMany(nameRefs);
      if (!cancelled) setNames(resolvedNames);
    })().catch((error) => {
      console.log('SyncConflictReviewSheet: failed to resolve entity names.', error);
    });
    return () => {
      cancelled = true;
    };
  }, [db, conflicts]);

  const summaries = useMemo(
    () => buildConflictSummaries(conflicts, snapshots, names, t),
    [conflicts, snapshots, names, t],
  );

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
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
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
                onKeepMine={() => keepLocal(db, item.id)}
                onKeepServer={() => keepServer(db, item.id)}
                onCloneBoard={
                  item.offerBoardClone && userId
                    ? () =>
                        keepServerAndCloneBoard(
                          db,
                          item.id,
                          userId,
                          t('board_copy_name', { name: item.title }),
                        )
                    : undefined
                }
                onOpenDiff={() => selectConflict(item.id)}
              />
            )}
          />
        )}
      </ResponsiveModal>

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
