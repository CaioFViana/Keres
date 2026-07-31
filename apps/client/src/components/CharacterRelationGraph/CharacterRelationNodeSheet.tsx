import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useTheme } from '../../theme';
import { RelationGraphNode } from '../../utils/characterRelationGraphLayout';

/**
 * Detalhes do personagem tocado no mapa de relações.
 *
 * Mesmo padrão do `SceneNodeSheet` do mapa de história: cada relação listada é clicável e
 * seleciona o personagem do outro lado sem fechar o painel, para dar para percorrer a rede de
 * relações a partir do mapa. Diferença de conteúdo: uma relação só tem "quem" e "que tipo de
 * relação", não "entra"/"sai" - não há direção aqui.
 */

export interface CharacterRelationNodeConnection {
  relationId: string;
  relationType: string;
  characterId: string;
  characterName: string;
}

interface CharacterRelationNodeSheetProps {
  node: RelationGraphNode | null;
  connections: CharacterRelationNodeConnection[];
  onClose: () => void;
  onOpenCharacter: (characterId: string) => void;
  onSelectCharacter: (characterId: string) => void;
}

const CharacterRelationNodeSheet: React.FC<CharacterRelationNodeSheetProps> = ({
  node,
  connections,
  onClose,
  onOpenCharacter,
  onSelectCharacter,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
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
    characterName: {
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
    connectionCharacter: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    connectionType: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
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

  return (
    <Modal animationType="slide" transparent visible onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          {/* Impede que o toque dentro do painel feche o painel. */}
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.sheet}>
              <View style={styles.handle} />

              <View style={styles.header}>
                <View style={styles.headerText}>
                  <Text style={styles.characterName}>{node.character.name}</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {node.isIsolated && (
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, { borderColor: colors.textSecondary }]}>
                    <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                      {t('character_relation_map_badge_isolated')}
                    </Text>
                  </View>
                </View>
              )}

              <ScrollView>
                <Text style={styles.sectionTitle}>{t('character_relation_map_relations_title')}</Text>
                {connections.length === 0 ? (
                  <Text style={styles.emptyText}>{t('character_relation_map_no_relations')}</Text>
                ) : (
                  connections.map(connection => (
                    <TouchableOpacity
                      key={connection.relationId}
                      style={styles.connection}
                      onPress={() => onSelectCharacter(connection.characterId)}
                    >
                      <Ionicons name="people-outline" size={16} color={colors.textSecondary} style={{ marginRight: 9 }} />
                      <View style={styles.connectionText}>
                        <Text style={styles.connectionCharacter} numberOfLines={1}>{connection.characterName}</Text>
                        <Text style={styles.connectionType} numberOfLines={1}>{connection.relationType}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  ))
                )}

                <TouchableOpacity style={styles.openButton} onPress={() => onOpenCharacter(node.id)}>
                  <Ionicons name="open-outline" size={18} color={colors.onPrimary} />
                  <Text style={styles.openButtonText}>{t('character_relation_map_open_character')}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default CharacterRelationNodeSheet;
