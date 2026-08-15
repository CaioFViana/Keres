import { Ionicons } from '@expo/vector-icons';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CollapsibleCard from '@/src/components/common/display/CollapsibleCard/CollapsibleCard';
import { relationSectionStyleDefs } from '@/src/components/features/relations/RelationManager/relationSectionStyles';
import type { MainSystemDrawerParamList } from '../../../../navigation/MainSystemStack';
import { useTheme } from '../../../../theme';
import { navigateToEntityDetail, toNavigableEntityType } from '../../../../utils/entityNavigation';

export interface RelatedEntityItem {
  id: string;
  name: string;
}

interface RelatedEntitiesListProps {
  title: string;
  noItemsMessage: string;
  /** Entity type (lowercase, e.g. "character") -> every match, with the id used to navigate. */
  groupedEntities: Record<string, RelatedEntityItem[]>;
}

/**
 * Read-only "what else references this" section for Note/Tag detail screens - names
 * grouped by entity type. Same collapsible-card look as every other relation section
 * (RelationManager/GenericRelationDisplay) instead of the plain bullet list this used to
 * be, so a note's/tag's related-entities section doesn't stand out as its own thing.
 *
 * Cada linha leva à entidade, como as de `SeeAlsoManager` - exceto para os tipos sem tela de
 * detalhe (`toNavigableEntityType` devolve `null`), que continuam sendo texto puro em vez de
 * um toque que não faz nada.
 */
const RelatedEntitiesList: React.FC<RelatedEntitiesListProps> = ({
  title,
  noItemsMessage,
  groupedEntities,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();

  const handlePress = useCallback(
    (entityType: string, entityId: string) => {
      const navigableType = toNavigableEntityType(entityType);
      const drawerNavigation =
        navigation.getParent<DrawerNavigationProp<MainSystemDrawerParamList>>();
      if (navigableType && drawerNavigation) {
        navigateToEntityDetail(drawerNavigation, navigableType, entityId);
      }
    },
    [navigation],
  );

  const styles = StyleSheet.create({
    ...relationSectionStyleDefs(colors),
    groupTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 8,
      marginBottom: 4,
    },
    relationRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    relationName: {
      flex: 1,
    },
  });

  const hasAnyEntity = Object.values(groupedEntities).some((items) => items.length > 0);

  return (
    <View style={styles.container}>
      <CollapsibleCard title={title} initialExpanded={false}>
        <View>
          {!hasAnyEntity ? (
            <Text style={{ color: colors.textSecondary }}>{noItemsMessage}</Text>
          ) : (
            Object.entries(groupedEntities).map(([entityType, items]) => {
              if (items.length === 0) {
                return null;
              }
              const isNavigable = toNavigableEntityType(entityType) !== null;
              return (
                <View key={entityType}>
                  <Text style={styles.groupTitle}>{t(`${entityType}_plural`)}</Text>
                  {items.map((item) => {
                    const content = (
                      <View style={styles.relationRow}>
                        <Text style={[styles.relationText, styles.relationName]}>{item.name}</Text>
                        {isNavigable && (
                          <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={colors.textSecondary}
                          />
                        )}
                      </View>
                    );
                    return isNavigable ? (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.relationItem}
                        onPress={() => handlePress(entityType, item.id)}
                        testID={`related-entity-${item.id}`}
                      >
                        {content}
                      </TouchableOpacity>
                    ) : (
                      <View key={item.id} style={styles.relationItem}>
                        {content}
                      </View>
                    );
                  })}
                </View>
              );
            })
          )}
        </View>
      </CollapsibleCard>
    </View>
  );
};

export default RelatedEntitiesList;
