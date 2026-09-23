import { Ionicons } from '@expo/vector-icons';
import { buildTrajectoryStops } from '@keres/shared/graphs/trajectories';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import ScreenSection from '@/src/components/layout/ScreenSection/ScreenSection';
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
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    order: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryContainer,
    },
    orderText: { color: colors.primary, fontWeight: '700' },
    names: { flex: 1 },
    place: { color: colors.text, fontWeight: '600' },
    scene: { color: colors.textSecondary },
    hint: { color: colors.textSecondary, marginTop: 8 },
    routePicker: { marginTop: 8 },
  });

  return (
    <>
      <ScreenSection title={t('trajectory_title')} />
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
      {stops.length === 0 ? (
        <Text style={styles.hint}>{t('trajectory_empty')}</Text>
      ) : (
        stops.map((stop, index) => (
          <TouchableOpacity
            key={`${stop.sceneId}-${index}`}
            style={styles.row}
            onPress={() => navigateToEntity('Location', stop.locationId)}
            accessibilityLabel={locationById.get(stop.locationId)?.name ?? stop.locationId}
          >
            <View style={styles.order}>
              <Text style={styles.orderText}>{index + 1}</Text>
            </View>
            <View style={styles.names}>
              <Text style={styles.place}>
                {locationById.get(stop.locationId)?.name ?? stop.locationId}
              </Text>
              <Text style={styles.scene}>{sceneById.get(stop.sceneId)?.name ?? stop.sceneId}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        ))
      )}
    </>
  );
};

export default CharacterTrajectorySection;
