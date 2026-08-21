import React, { useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';
import type { SceneSelect } from '@/src/db/schema';
import { useNavigateToEntityDetail } from '@/src/hooks/useNavigateToEntityDetail';
import { useTheme } from '@/src/theme';
import type { NavigableEntityType } from '@/src/utils/entityNavigation';
import GenericRelationDisplay from '@/src/components/features/relations/RelationManager/GenericRelationDisplay';
import RelationAttributeLine from '@/src/components/features/relations/RelationManager/RelationAttributeLine';

type RelatedEntity = { id: string; name: string };

export interface ScenePresenceEntry<TItem extends RelatedEntity> {
  item: TItem;
  scenes: SceneSelect[];
}

export function groupScenePresenceEntries<TItem extends RelatedEntity>(
  pairs: { item: TItem; scene: SceneSelect }[],
): ScenePresenceEntry<TItem>[] {
  const grouped = new Map<string, ScenePresenceEntry<TItem>>();

  for (const { item, scene } of pairs) {
    const entry = grouped.get(item.id) || { item, scenes: [] };
    if (!grouped.has(item.id)) grouped.set(item.id, entry);
    if (!entry.scenes.some((existingScene) => existingScene.id === scene.id)) {
      entry.scenes.push(scene);
    }
  }

  return Array.from(grouped.values())
    .map((entry) => ({
      ...entry,
      scenes: entry.scenes.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.item.name.localeCompare(b.item.name));
}

interface ScenePresenceListProps<TItem extends RelatedEntity> {
  entries: ScenePresenceEntry<TItem>[];
  title: string;
  noItemsMessage: string;
  entityType: NavigableEntityType;
  sceneLabel: string;
}

/** Exibe entidades relacionadas, agrupadas pelas cenas em que aparecem. */
const ScenePresenceList = <TItem extends RelatedEntity>({
  entries,
  title,
  noItemsMessage,
  entityType,
  sceneLabel,
}: ScenePresenceListProps<TItem>) => {
  const { colors } = useTheme();
  const navigateToDetail = useNavigateToEntityDetail();

  const relations = useMemo(
    () =>
      entries.map((entry) => ({
        id: entry.item.id,
        isDeleted: false,
        ...entry,
      })),
    [entries],
  );

  const handleItemPress = useCallback(
    (item: TItem) => {
      navigateToDetail(entityType, item.id);
    },
    [entityType, navigateToDetail],
  );

  return (
    <GenericRelationDisplay<TItem, (typeof relations)[number]>
      relations={relations}
      getRelatedItem={(itemId) => entries.find((entry) => entry.item.id === itemId)?.item}
      getRelationItemId={(relation) => relation.item.id}
      getItemDisplayName={(item) => item.name}
      noItemsMessage={noItemsMessage}
      renderItemExtraContent={(relation, item) => (
        <View>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{item.name}</Text>
          {relation.scenes.map((scene) => (
            <RelationAttributeLine key={scene.id} label={sceneLabel} value={scene.name} />
          ))}
        </View>
      )}
      title={title}
      onItemPress={handleItemPress}
    />
  );
};

export default ScenePresenceList;
