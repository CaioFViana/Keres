import Button from '@/src/components/common/controls/Button/Button';
import CollapsibleCard from '@/src/components/common/display/CollapsibleCard/CollapsibleCard';
import RelationRow from '@/src/components/features/relations/RelationManager/RelationRow';
import { relationSectionStyleDefs } from '@/src/components/features/relations/RelationManager/relationSectionStyles';
import type { ChapterRelationType, ChapterType } from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigateToEntityDetail } from '../../../../hooks/useNavigateToEntityDetail';
import { useTheme } from '../../../../theme';
import { AppAlert } from '../../../../utils/AppAlert';
import ChronologyModal, { type ChronologyTarget } from './ChronologyModal';

/**
 * When this container happened, relative to the others.
 *
 * A different axis from the chapter numbering, which is the order things are *told*. Nothing here
 * touches an index: a story can be told out of order and still have one chronology behind it, and
 * this is where that gets written down.
 *
 * Every row is read from **this** container's point of view. A statement stored as "the war before
 * chapter 4" reads here as "happened before Chapter 4" on the war's screen and "happened after The
 * war" on chapter 4's - the same row, said from where the reader is standing. Showing the raw
 * columns instead would make half the list read backwards.
 */

export interface ChronologyRelationView {
  id: string;
  chapter1Id: string;
  chapter2Id: string;
  relationType: ChapterRelationType;
}

interface ChronologyManagerProps {
  relations: ChronologyRelationView[];
  /** Every container in the story, to name the other end and to offer the picker. */
  containers: { id: string; name: string; type: ChapterType }[];
  currentChapterId: string;
  editable: boolean;
  onSave: (targetId: string, relationType: ChapterRelationType, relationId?: string) => void;
  onDelete: (relationId: string) => void;
}

/**
 * The same statement, said from the other end.
 *
 * `before` and `during` are directional, so reading a row from the second container means turning
 * it around; `overlaps` and `simultaneous` read the same either way.
 */
export function readFromPerspective(
  relation: ChronologyRelationView,
  chapterId: string,
): { otherId: string; phraseKey: string } {
  const isSubject = relation.chapter1Id === chapterId;
  const otherId = isSubject ? relation.chapter2Id : relation.chapter1Id;
  if (isSubject) return { otherId, phraseKey: `chronology_type_${relation.relationType}` };

  const reversed: Record<ChapterRelationType, string> = {
    before: 'chronology_type_after',
    during: 'chronology_type_contains',
    overlaps: 'chronology_type_overlaps',
    simultaneous: 'chronology_type_simultaneous',
  };
  return { otherId, phraseKey: reversed[relation.relationType] };
}

const ChronologyManager: React.FC<ChronologyManagerProps> = ({
  relations,
  containers,
  currentChapterId,
  editable,
  onSave,
  onDelete,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigateToDetail = useNavigateToEntityDetail();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editing, setEditing] = useState<ChronologyRelationView | null>(null);

  const mine = useMemo(
    () =>
      relations.filter(
        (relation) =>
          relation.chapter1Id === currentChapterId || relation.chapter2Id === currentChapterId,
      ),
    [relations, currentChapterId],
  );

  const nameOf = useCallback(
    (id: string) => containers.find((container) => container.id === id)?.name ?? id,
    [containers],
  );

  /**
   * Containers still available to talk about.
   *
   * A pair holds one statement, so anything already related is out - offering it would produce a
   * refusal from the service rather than a second row. The one being edited keeps its own target,
   * or editing would have nothing to point at.
   */
  const targets: ChronologyTarget[] = useMemo(() => {
    const taken = new Set(
      mine
        .filter((relation) => relation.id !== editing?.id)
        .map((relation) => readFromPerspective(relation, currentChapterId).otherId),
    );
    return containers
      .filter((container) => container.id !== currentChapterId && !taken.has(container.id))
      .map((container) => ({
        id: container.id,
        name: container.name,
        isEvent: container.type === 'event',
      }));
  }, [containers, mine, currentChapterId, editing]);

  const confirmDelete = (relationId: string) =>
    AppAlert.alert(
      t('chronology_delete_title'),
      t('chronology_delete_message'),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('delete'), style: 'destructive', onPress: () => onDelete(relationId) },
      ],
      { cancelable: true },
    );

  const styles = StyleSheet.create({
    ...relationSectionStyleDefs(colors),
    relationTypeText: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
    buttonContainer: { marginBottom: 10 },
    emptyText: { color: colors.textSecondary },
  });

  return (
    <View style={styles.container}>
      <CollapsibleCard title={t('chronology_section_title')} initialExpanded={false}>
        <View>
          {editable && (
            <View style={styles.buttonContainer}>
              <Button
                onPress={() => {
                  setEditing(null);
                  setIsModalVisible(true);
                }}
                disabled={targets.length === 0}
                testID="add-chronology"
              >
                {t('chronology_add')}
              </Button>
            </View>
          )}

          {mine.length === 0 ? (
            <Text style={styles.emptyText}>{t('chronology_none')}</Text>
          ) : (
            mine.map((relation) => {
              const { otherId, phraseKey } = readFromPerspective(relation, currentChapterId);
              return (
                <RelationRow
                  key={relation.id}
                  // Tappable only while read-only, the same rule the character relations follow:
                  // navigating away mid-edit would strand whatever is being typed.
                  onPress={editable ? undefined : () => navigateToDetail('Chapter', otherId)}
                  extraActions={
                    editable && (
                      <TouchableOpacity
                        onPress={() => {
                          setEditing(relation);
                          setIsModalVisible(true);
                        }}
                        accessibilityLabel={t('chronology_add')}
                      >
                        <Ionicons name="create-outline" size={22} color={colors.primary} />
                      </TouchableOpacity>
                    )
                  }
                  onRemove={editable ? () => confirmDelete(relation.id) : undefined}
                >
                  <Text style={styles.relationText}>{nameOf(otherId)}</Text>
                  <Text style={styles.relationTypeText}>{t(phraseKey)}</Text>
                </RelationRow>
              );
            })
          )}
        </View>
      </CollapsibleCard>

      <ChronologyModal
        visible={isModalVisible}
        subjectName={nameOf(currentChapterId)}
        targets={targets}
        initial={
          editing
            ? {
                targetId: readFromPerspective(editing, currentChapterId).otherId,
                relationType: editing.relationType,
              }
            : null
        }
        onCancel={() => setIsModalVisible(false)}
        onConfirm={(targetId, relationType) => {
          setIsModalVisible(false);
          onSave(targetId, relationType, editing?.id);
        }}
      />
    </View>
  );
};

export default ChronologyManager;
