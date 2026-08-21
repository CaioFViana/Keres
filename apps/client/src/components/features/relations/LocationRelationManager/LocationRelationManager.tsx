import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { LocationRelationSelect, LocationSelect } from '../../../../db/schema';
import { useTheme } from '../../../../theme';
import { useNavigateToEntityDetail } from '../../../../hooks/useNavigateToEntityDetail';
import { relationSectionStyleDefs } from '@/src/components/features/relations/RelationManager/relationSectionStyles';
import CollapsibleCard from '@/src/components/common/display/CollapsibleCard/CollapsibleCard';
import Button from '@/src/components/common/controls/Button/Button';
import LocationPickerModal from '@/src/components/features/relations/LocationRelationManager/LocationPickerModal';
import RelationRow from '@/src/components/features/relations/RelationManager/RelationRow';
import { AppAlert } from '../../../../utils/AppAlert';

interface LocationRelationManagerProps {
  currentLocationId: string;
  allLocations: LocationSelect[];
  allLocationRelations: LocationRelationSelect[];
  onSetParent: (newParentId: string | null) => void;
  onAddChild: (childId: string) => void;
  onAddConnection: (otherLocationId: string) => void;
  onRemoveRelation: (relationId: string) => void;
  editable: boolean;
}

type ActivePicker = 'parent' | 'child' | 'connection' | null;

/** Ancestrais de `locationId` (não inclui ele mesmo) - cadeia de pais via 'contains', calculada
 *  em memória a partir da lista já carregada pela tela (evita ida e volta ao banco por toque). */
const computeAncestorIds = (
  relations: LocationRelationSelect[],
  locationId: string,
): Set<string> => {
  const ancestors = new Set<string>();
  let currentId: string | undefined = locationId;

  while (currentId) {
    const parentEdge = relations.find(
      (r) => r.relationType === 'contains' && r.locationBId === currentId && !r.isDeleted,
    );
    if (!parentEdge || ancestors.has(parentEdge.locationAId)) break;
    ancestors.add(parentEdge.locationAId);
    currentId = parentEdge.locationAId;
  }

  return ancestors;
};

/** Descendentes de `locationId` (não inclui ele mesmo), via BFS sobre as arestas 'contains'. */
const computeDescendantIds = (
  relations: LocationRelationSelect[],
  locationId: string,
): Set<string> => {
  const descendants = new Set<string>();
  const queue = [locationId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = relations.filter(
      (r) => r.relationType === 'contains' && r.locationAId === current && !r.isDeleted,
    );
    for (const child of children) {
      if (!descendants.has(child.locationBId)) {
        descendants.add(child.locationBId);
        queue.push(child.locationBId);
      }
    }
  }

  return descendants;
};

const LocationRelationManager: React.FC<LocationRelationManagerProps> = ({
  currentLocationId,
  allLocations,
  allLocationRelations,
  onSetParent,
  onAddChild,
  onAddConnection,
  onRemoveRelation,
  editable,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigateToDetail = useNavigateToEntityDetail();
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);

  const liveRelations = useMemo(
    () => allLocationRelations.filter((r) => !r.isDeleted),
    [allLocationRelations],
  );

  const parentRelation = useMemo(
    () =>
      liveRelations.find(
        (r) => r.relationType === 'contains' && r.locationBId === currentLocationId,
      ),
    [liveRelations, currentLocationId],
  );
  const childRelations = useMemo(
    () =>
      liveRelations.filter(
        (r) => r.relationType === 'contains' && r.locationAId === currentLocationId,
      ),
    [liveRelations, currentLocationId],
  );
  const connectionRelations = useMemo(
    () =>
      liveRelations.filter(
        (r) =>
          r.relationType === 'connected_to' &&
          (r.locationAId === currentLocationId || r.locationBId === currentLocationId),
      ),
    [liveRelations, currentLocationId],
  );

  const ancestorIds = useMemo(
    () => computeAncestorIds(liveRelations, currentLocationId),
    [liveRelations, currentLocationId],
  );
  const descendantIds = useMemo(
    () => computeDescendantIds(liveRelations, currentLocationId),
    [liveRelations, currentLocationId],
  );

  const getLocationName = useCallback(
    (locationId: string) => {
      return allLocations.find((l) => l.id === locationId)?.name || t('unknown_location');
    },
    [allLocations, t],
  );

  const handleLocationPress = useCallback(
    (locationId: string) => {
      navigateToDetail('Location', locationId);
    },
    [navigateToDetail],
  );

  const parentPickerCandidates = useMemo(
    () =>
      allLocations.filter(
        (l) =>
          l.id !== currentLocationId &&
          !descendantIds.has(l.id) &&
          l.id !== parentRelation?.locationAId,
      ),
    [allLocations, currentLocationId, descendantIds, parentRelation],
  );

  const childPickerCandidates = useMemo(
    () =>
      allLocations.filter(
        (l) =>
          l.id !== currentLocationId &&
          !ancestorIds.has(l.id) &&
          !childRelations.some((r) => r.locationBId === l.id),
      ),
    [allLocations, currentLocationId, ancestorIds, childRelations],
  );

  const connectionPickerCandidates = useMemo(
    () =>
      allLocations.filter(
        (l) =>
          l.id !== currentLocationId &&
          !connectionRelations.some((r) => r.locationAId === l.id || r.locationBId === l.id),
      ),
    [allLocations, currentLocationId, connectionRelations],
  );

  const handlePickerSelect = (locationId: string) => {
    if (activePicker === 'parent') {
      onSetParent(locationId);
    } else if (activePicker === 'child') {
      onAddChild(locationId);
    } else if (activePicker === 'connection') {
      onAddConnection(locationId);
    }
    setActivePicker(null);
  };

  const handleRemoveParent = () => {
    AppAlert.alert(t('remove_parent_location_title'), t('remove_parent_location_message'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('remove'), style: 'destructive', onPress: () => onSetParent(null) },
    ]);
  };

  const handleRemoveRelation = (relationId: string, titleKey: string, messageKey: string) => {
    AppAlert.alert(t(titleKey), t(messageKey), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('remove'), style: 'destructive', onPress: () => onRemoveRelation(relationId) },
    ]);
  };

  const styles = StyleSheet.create({
    ...relationSectionStyleDefs(colors),
    subsectionTitle: {
      fontSize: 15,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 10,
      marginBottom: 6,
    },
    buttonContainer: {
      marginBottom: 10,
    },
    noRelationsText: {
      color: colors.textSecondary,
      marginBottom: 8,
    },
  });

  return (
    <View style={styles.container}>
      <CollapsibleCard title={t('location_structure_title')} initialExpanded={false}>
        <View>
          {/* Parent Location */}
          <Text style={styles.subsectionTitle}>{t('parent_location')}</Text>
          {parentRelation ? (
            <RelationRow
              // Em `editable` (form) a linha não navega - sair da tela perderia alterações
              // não salvas do formulário.
              onPress={editable ? undefined : () => handleLocationPress(parentRelation.locationAId)}
              onRemove={editable ? handleRemoveParent : undefined}
            >
              <Text style={styles.relationText}>{getLocationName(parentRelation.locationAId)}</Text>
            </RelationRow>
          ) : (
            <Text style={styles.noRelationsText}>{t('no_parent_location')}</Text>
          )}
          {editable && (
            <View style={styles.buttonContainer}>
              <Button onPress={() => setActivePicker('parent')}>
                {parentRelation ? t('change_parent') : t('set_parent')}
              </Button>
            </View>
          )}

          {/* Child Locations */}
          <Text style={styles.subsectionTitle}>{t('child_locations')}</Text>
          {childRelations.length === 0 ? (
            <Text style={styles.noRelationsText}>{t('no_child_locations')}</Text>
          ) : (
            childRelations.map((rel) => (
              <RelationRow
                key={rel.id}
                onPress={editable ? undefined : () => handleLocationPress(rel.locationBId)}
                onRemove={
                  editable
                    ? () =>
                        handleRemoveRelation(
                          rel.id,
                          'remove_child_location_title',
                          'remove_child_location_message',
                        )
                    : undefined
                }
              >
                <Text style={styles.relationText}>{getLocationName(rel.locationBId)}</Text>
              </RelationRow>
            ))
          )}
          {editable && (
            <View style={styles.buttonContainer}>
              <Button onPress={() => setActivePicker('child')}>{t('add_child_location')}</Button>
            </View>
          )}

          {/* Connected Locations */}
          <Text style={styles.subsectionTitle}>{t('connected_locations')}</Text>
          {connectionRelations.length === 0 ? (
            <Text style={styles.noRelationsText}>{t('no_connected_locations')}</Text>
          ) : (
            connectionRelations.map((rel) => {
              const otherId =
                rel.locationAId === currentLocationId ? rel.locationBId : rel.locationAId;
              return (
                <RelationRow
                  key={rel.id}
                  onPress={editable ? undefined : () => handleLocationPress(otherId)}
                  onRemove={
                    editable
                      ? () =>
                          handleRemoveRelation(
                            rel.id,
                            'remove_connection_title',
                            'remove_connection_message',
                          )
                      : undefined
                  }
                >
                  <Text style={styles.relationText}>{getLocationName(otherId)}</Text>
                </RelationRow>
              );
            })
          )}
          {editable && (
            <View style={styles.buttonContainer}>
              <Button onPress={() => setActivePicker('connection')}>{t('add_connection')}</Button>
            </View>
          )}
        </View>
      </CollapsibleCard>

      <LocationPickerModal
        isVisible={activePicker !== null}
        onClose={() => setActivePicker(null)}
        onSelect={handlePickerSelect}
        title={
          activePicker === 'parent'
            ? t('select_parent_location')
            : activePicker === 'child'
              ? t('select_child_location')
              : t('select_location_to_connect')
        }
        candidates={
          activePicker === 'parent'
            ? parentPickerCandidates
            : activePicker === 'child'
              ? childPickerCandidates
              : connectionPickerCandidates
        }
      />
    </View>
  );
};

export default LocationRelationManager;
