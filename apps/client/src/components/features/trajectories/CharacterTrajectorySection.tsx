import { buildTrajectoryStops } from '@keres/shared/graphs/trajectories';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import CollapsibleCard from '@/src/components/common/display/CollapsibleCard/CollapsibleCard';
import EntityRelationList from '@/src/components/common/display/EntityRelationList/EntityRelationList';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import { useCharacterTrajectoryData } from '@/src/hooks/useCharacterTrajectoryData';
import { useNavigateToEntityDetail } from '@/src/hooks/useNavigateToEntityDetail';
import { useTheme } from '@/src/theme';

interface CharacterTrajectorySectionProps {
  characterId: string;
  storyId: string;
  storyType: 'linear' | 'branching';
  scenes: {
    id: string;
    chapterId: string | null;
    index: number;
    locationId: string | null;
    isDeleted: boolean;
    name: string;
  }[];
  appearances: { characterId: string; sceneId: string; isDeleted: boolean }[];
  locations: { id: string; name: string }[];
}

/**
 * Where the character has been, in narrative order: one row per stop (scene + place),
 * branching resolved through an explicit Route the reader picks. Derived, never stored.
 */
const CharacterTrajectorySection: React.FC<CharacterTrajectorySectionProps> = ({
  characterId,
  storyId,
  storyType,
  scenes,
  appearances,
  locations,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigateToEntity = useNavigateToEntityDetail();
  const { chapters, routes, stepsByRoute } = useCharacterTrajectoryData(storyId, storyType);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const routeId = selectedRouteId ?? routes[0]?.id ?? null;
  const stops = useMemo(
    () =>
      buildTrajectoryStops({
        scenes: scenes.filter((scene) => !scene.isDeleted),
        chapters,
        relevantSceneIds: new Set(
          appearances
            .filter((appearance) => appearance.characterId === characterId && !appearance.isDeleted)
            .map((appearance) => appearance.sceneId),
        ),
        storyType,
        steps: routeId ? (stepsByRoute[routeId] ?? []) : [],
      }),
    [appearances, chapters, characterId, routeId, scenes, stepsByRoute, storyType],
  );
  const sceneById = useMemo(() => new Map(scenes.map((scene) => [scene.id, scene])), [scenes]);
  const locationById = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations],
  );

  const styles = StyleSheet.create({
    order: {
      width: 26,
      height: 26,
      borderRadius: 13,
      marginRight: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryContainer,
    },
    orderText: { color: colors.primary, fontWeight: '700' },
    scene: { color: colors.textSecondary },
    hint: { color: colors.textSecondary, marginTop: 8 },
    routePicker: { marginTop: 8 },
  });

  return (
    <CollapsibleCard
      title={t('trajectory_section_title', { count: stops.length })}
      initialExpanded={false}
    >
      {storyType === 'branching' &&
        (routes.length === 0 ? (
          <Text style={styles.hint}>{t('trajectory_no_routes')}</Text>
        ) : (
          <View style={styles.routePicker}>
            <SingleSelectPill
              options={routes.map((route) => ({ label: route.name, value: route.id }))}
              value={routeId ?? ''}
              onValueChange={(value) => setSelectedRouteId(value || null)}
              placeholder={t('trajectory_route')}
              multiple={false}
            />
          </View>
        ))}
      <EntityRelationList
        emptyText={t('trajectory_empty')}
        items={stops.map((stop, index) => ({
          id: `${stop.sceneId}-${index}`,
          testID: `trajectory-stop-${index}`,
          title: locationById.get(stop.locationId)?.name ?? stop.locationId,
          color: colors.primary,
          leading: (
            <View style={styles.order}>
              <Text style={styles.orderText} testID={`trajectory-order-${index}`}>
                {index + 1}
              </Text>
            </View>
          ),
          details: (
            <Text style={styles.scene}>{sceneById.get(stop.sceneId)?.name ?? stop.sceneId}</Text>
          ),
          onPress: () => navigateToEntity('Location', stop.locationId),
        }))}
      />
    </CollapsibleCard>
  );
};

export default CharacterTrajectorySection;
