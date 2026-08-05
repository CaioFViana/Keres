import { Ionicons } from '@expo/vector-icons';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LocationRelationSelect, LocationSelect } from '../../db/schema';
import type { MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { useTheme } from '../../theme';
import { navigateToEntityDetail } from '../../utils/entityNavigation';
import { relationSectionStyleDefs } from '../RelationManager/relationSectionStyles';
import Button from '../common/Button/Button';
import LocationPickerModal from './LocationPickerModal';

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
const computeAncestorIds = (relations: LocationRelationSelect[], locationId: string): Set<string> => {
  const ancestors = new Set<string>();
  let currentId: string | undefined = locationId;

  while (currentId) {
    const parentEdge = relations.find(r => r.relationType === 'contains' && r.locationBId === currentId && !r.isDeleted);
    if (!parentEdge || ancestors.has(parentEdge.locationAId)) break;
    ancestors.add(parentEdge.locationAId);
    currentId = parentEdge.locationAId;
  }

  return ancestors;
};

/** Descendentes de `locationId` (não inclui ele mesmo), via BFS sobre as arestas 'contains'. */
const computeDescendantIds = (relations: LocationRelationSelect[], locationId: string): Set<string> => {
  const descendants = new Set<string>();
  const queue = [locationId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = relations.filter(r => r.relationType === 'contains' && r.locationAId === current && !r.isDeleted);
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
  const navigation = useNavigation();
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);
  const [isCollapsed, setIsCollapsed] = useState(true);

  const liveRelations = useMemo(() => allLocationRelations.filter(r => !r.isDeleted), [allLocationRelations]);

  const parentRelation = useMemo(
    () => liveRelations.find(r => r.relationType === 'contains' && r.locationBId === currentLocationId),
    [liveRelations, currentLocationId]
  );
  const childRelations = useMemo(
    () => liveRelations.filter(r => r.relationType === 'contains' && r.locationAId === currentLocationId),
    [liveRelations, currentLocationId]
  );
  const connectionRelations = useMemo(
    () => liveRelations.filter(r => r.relationType === 'connected_to' && (r.locationAId === currentLocationId || r.locationBId === currentLocationId)),
    [liveRelations, currentLocationId]
  );

  const ancestorIds = useMemo(() => computeAncestorIds(liveRelations, currentLocationId), [liveRelations, currentLocationId]);
  const descendantIds = useMemo(() => computeDescendantIds(liveRelations, currentLocationId), [liveRelations, currentLocationId]);

  const getLocationName = useCallback((locationId: string) => {
    return allLocations.find(l => l.id === locationId)?.name || t('unknown_location');
  }, [allLocations, t]);

  const handleLocationPress = useCallback((locationId: string) => {
    const drawerNavigation = navigation.getParent<DrawerNavigationProp<MainSystemDrawerParamList>>();
    if (drawerNavigation) {
      navigateToEntityDetail(drawerNavigation, 'Location', locationId);
    }
  }, [navigation]);

  const parentPickerCandidates = useMemo(() => allLocations.filter(l =>
    l.id !== currentLocationId && !descendantIds.has(l.id) && l.id !== parentRelation?.locationAId
  ), [allLocations, currentLocationId, descendantIds, parentRelation]);

  const childPickerCandidates = useMemo(() => allLocations.filter(l =>
    l.id !== currentLocationId && !ancestorIds.has(l.id) && !childRelations.some(r => r.locationBId === l.id)
  ), [allLocations, currentLocationId, ancestorIds, childRelations]);

  const connectionPickerCandidates = useMemo(() => allLocations.filter(l =>
    l.id !== currentLocationId && !connectionRelations.some(r => r.locationAId === l.id || r.locationBId === l.id)
  ), [allLocations, currentLocationId, connectionRelations]);

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
    Alert.alert(t('remove_parent_location_title'), t('remove_parent_location_message'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('remove'), style: 'destructive', onPress: () => onSetParent(null) },
    ]);
  };

  const handleRemoveRelation = (relationId: string, titleKey: string, messageKey: string) => {
    Alert.alert(t(titleKey), t(messageKey), [
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
    actionsRow: {
      flexDirection: 'row',
      gap: 12,
    },
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => setIsCollapsed(!isCollapsed)} style={styles.collapsibleHeader}>
        <Text style={styles.collapsibleHeaderText}>{t('location_structure_title')}</Text>
        <Ionicons name={isCollapsed ? 'chevron-down-outline' : 'chevron-up-outline'} size={24} color={colors.text} />
      </TouchableOpacity>

      {!isCollapsed && (
        <View style={styles.collapsibleContent}>
          {/* Parent Location */}
          <Text style={styles.subsectionTitle}>{t('parent_location')}</Text>
          {parentRelation ? (
            <View style={styles.relationItem}>
              <TouchableOpacity style={styles.relationItemContent} onPress={() => handleLocationPress(parentRelation.locationAId)} activeOpacity={0.7}>
                <Text style={styles.relationText}>{getLocationName(parentRelation.locationAId)}</Text>
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} style={styles.chevron} />
              {editable && (
                <TouchableOpacity onPress={handleRemoveParent}>
                  <Ionicons name="trash-outline" size={22} color={colors.error} />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <Text style={styles.noRelationsText}>{t('no_parent_location')}</Text>
          )}
          {editable && (
            <View style={styles.buttonContainer}>
              <Button onPress={() => setActivePicker('parent')}>{parentRelation ? t('change_parent') : t('set_parent')}</Button>
            </View>
          )}

          {/* Child Locations */}
          <Text style={styles.subsectionTitle}>{t('child_locations')}</Text>
          {childRelations.length === 0 ? (
            <Text style={styles.noRelationsText}>{t('no_child_locations')}</Text>
          ) : (
            childRelations.map(rel => (
              <View key={rel.id} style={styles.relationItem}>
                <TouchableOpacity style={styles.relationItemContent} onPress={() => handleLocationPress(rel.locationBId)} activeOpacity={0.7}>
                  <Text style={styles.relationText}>{getLocationName(rel.locationBId)}</Text>
                </TouchableOpacity>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} style={styles.chevron} />
                {editable && (
                  <TouchableOpacity onPress={() => handleRemoveRelation(rel.id, 'remove_child_location_title', 'remove_child_location_message')}>
                    <Ionicons name="trash-outline" size={22} color={colors.error} />
                  </TouchableOpacity>
                )}
              </View>
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
            connectionRelations.map(rel => {
              const otherId = rel.locationAId === currentLocationId ? rel.locationBId : rel.locationAId;
              return (
                <View key={rel.id} style={styles.relationItem}>
                  <TouchableOpacity style={styles.relationItemContent} onPress={() => handleLocationPress(otherId)} activeOpacity={0.7}>
                    <Text style={styles.relationText}>{getLocationName(otherId)}</Text>
                  </TouchableOpacity>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} style={styles.chevron} />
                  {editable && (
                    <TouchableOpacity onPress={() => handleRemoveRelation(rel.id, 'remove_connection_title', 'remove_connection_message')}>
                      <Ionicons name="trash-outline" size={22} color={colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
          {editable && (
            <View style={styles.buttonContainer}>
              <Button onPress={() => setActivePicker('connection')}>{t('add_connection')}</Button>
            </View>
          )}
        </View>
      )}

      <LocationPickerModal
        isVisible={activePicker !== null}
        onClose={() => setActivePicker(null)}
        onSelect={handlePickerSelect}
        title={
          activePicker === 'parent' ? t('select_parent_location')
            : activePicker === 'child' ? t('select_child_location')
            : t('select_location_to_connect')
        }
        candidates={
          activePicker === 'parent' ? parentPickerCandidates
            : activePicker === 'child' ? childPickerCandidates
            : connectionPickerCandidates
        }
      />
    </View>
  );
};

export default LocationRelationManager;
