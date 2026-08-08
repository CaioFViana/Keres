import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ResponsiveModal from '../layout/ResponsiveModal/ResponsiveModal';
import { useTheme } from '../../theme';
import { LocationGraphNode } from '../../utils/locationGraphLayout';

/**
 * Detalhes da Location tocada no grafo de estrutura. Mesmo padrão dos outros node sheets do
 * app: cada linha listada é clicável e re-seleciona o nó do outro lado sem fechar o painel.
 * Três seções em vez de uma lista só de "relations", porque Parent/Children/Connected têm
 * semânticas diferentes (pai é no máximo um; filhos e conexões são listas).
 */

export interface LocationNodeConnection {
  relationId: string;
  locationId: string;
  locationName: string;
}

interface LocationNodeSheetProps {
  node: LocationGraphNode | null;
  parent: LocationNodeConnection | null;
  childLocations: LocationNodeConnection[];
  connections: LocationNodeConnection[];
  onClose: () => void;
  onOpenLocation: (locationId: string) => void;
  onSelectLocation: (locationId: string) => void;
}

const LocationNodeSheet: React.FC<LocationNodeSheetProps> = ({
  node,
  parent,
  childLocations,
  connections,
  onClose,
  onOpenLocation,
  onSelectLocation,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
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
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    headerText: {
      flex: 1,
      marginRight: 12,
    },
    locationName: {
      fontSize: 19,
      fontWeight: 'bold',
      color: colors.text,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 10,
    },
    badge: {
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 3,
      marginRight: 8,
      marginBottom: 6,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '600',
    },
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
      fontSize: 13,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    connection: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingVertical: 9,
      paddingHorizontal: 11,
      marginBottom: 7,
    },
    connectionText: {
      flex: 1,
      marginRight: 8,
    },
    connectionLocation: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    openButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 13,
      marginTop: 22,
    },
    openButtonText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: 'bold',
      marginLeft: 8,
    },
    closeButton: {
      padding: 4,
    },
  }), [colors]);

  if (!node) return null;

  const renderConnectionRow = (connection: LocationNodeConnection, icon: 'arrow-up-outline' | 'arrow-down-outline' | 'git-network-outline') => (
    <TouchableOpacity
      key={connection.relationId}
      style={styles.connection}
      onPress={() => onSelectLocation(connection.locationId)}
    >
      <Ionicons name={icon} size={16} color={colors.textSecondary} style={{ marginRight: 9 }} />
      <View style={styles.connectionText}>
        <Text style={styles.connectionLocation} numberOfLines={1}>{connection.locationName}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <ResponsiveModal visible onClose={onClose} placement="bottom" contentStyle={styles.sheet} maxHeight="78%">
              <View style={styles.handle} />

              <View style={styles.header}>
                <View style={styles.headerText}>
                  <Text style={styles.locationName}>{node.location.name}</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {node.isIsolated && (
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, { borderColor: colors.textSecondary }]}>
                    <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                      {t('location_graph_badge_isolated')}
                    </Text>
                  </View>
                </View>
              )}

              <ScrollView>
                <Text style={styles.sectionTitle}>{t('parent_location')}</Text>
                {!parent ? (
                  <Text style={styles.emptyText}>{t('no_parent_location')}</Text>
                ) : (
                  renderConnectionRow(parent, 'arrow-up-outline')
                )}

                <Text style={styles.sectionTitle}>{t('child_locations')}</Text>
                {childLocations.length === 0 ? (
                  <Text style={styles.emptyText}>{t('no_child_locations')}</Text>
                ) : (
                  childLocations.map(child => renderConnectionRow(child, 'arrow-down-outline'))
                )}

                <Text style={styles.sectionTitle}>{t('connected_locations')}</Text>
                {connections.length === 0 ? (
                  <Text style={styles.emptyText}>{t('no_connected_locations')}</Text>
                ) : (
                  connections.map(connection => renderConnectionRow(connection, 'git-network-outline'))
                )}

                <TouchableOpacity style={styles.openButton} onPress={() => onOpenLocation(node.id)}>
                  <Ionicons name="open-outline" size={18} color={colors.onPrimary} />
                  <Text style={styles.openButtonText}>{t('location_graph_open_location')}</Text>
                </TouchableOpacity>
              </ScrollView>
    </ResponsiveModal>
  );
};

export default LocationNodeSheet;
