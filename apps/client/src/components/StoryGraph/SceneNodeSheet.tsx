import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useTheme } from '../../theme';
import { GraphNode } from '../../utils/storyGraphLayout';

/**
 * Detalhes da cena tocada no mapa.
 *
 * As escolhas que entram e saem são clicáveis: tocar numa delas seleciona a cena vizinha sem
 * fechar o painel, o que permite percorrer a ramificação a partir do mapa. É o passo que falta
 * para "ver o grafo" virar "explorar a história".
 */

export interface SceneNodeConnection {
  choiceId: string;
  /** Texto da escolha; vazio quando é uma transição implícita. */
  text: string;
  sceneId: string;
  sceneName: string;
}

interface SceneNodeSheetProps {
  node: GraphNode | null;
  outgoing: SceneNodeConnection[];
  incoming: SceneNodeConnection[];
  onClose: () => void;
  onOpenScene: (sceneId: string) => void;
  onSelectScene: (sceneId: string) => void;
}

const SceneNodeSheet: React.FC<SceneNodeSheetProps> = ({
  node,
  outgoing,
  incoming,
  onClose,
  onOpenScene,
  onSelectScene,
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
    sceneName: {
      fontSize: 19,
      fontWeight: 'bold',
      color: colors.text,
    },
    chapterName: {
      fontSize: 13,
      marginTop: 2,
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
    summary: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
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
    connectionChoice: {
      fontSize: 13,
      color: colors.text,
    },
    connectionImplicit: {
      fontStyle: 'italic',
      color: colors.textSecondary,
    },
    connectionScene: {
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

  const renderConnections = (connections: SceneNodeConnection[], emptyMessage: string, icon: 'arrow-forward' | 'arrow-back') => {
    if (connections.length === 0) {
      return <Text style={styles.emptyText}>{emptyMessage}</Text>;
    }

    return connections.map(connection => (
      <TouchableOpacity
        key={connection.choiceId}
        style={styles.connection}
        onPress={() => onSelectScene(connection.sceneId)}
      >
        <Ionicons name={icon} size={16} color={colors.textSecondary} style={{ marginRight: 9 }} />
        <View style={styles.connectionText}>
          <Text style={[styles.connectionChoice, !connection.text && styles.connectionImplicit]} numberOfLines={2}>
            {connection.text || t('story_map_implicit_choice')}
          </Text>
          <Text style={styles.connectionScene} numberOfLines={1}>{connection.sceneName}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    ));
  };

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
                  <Text style={styles.sceneName}>{node.scene.name}</Text>
                  {!!node.chapterName && (
                    <Text style={[styles.chapterName, { color: node.chapterColor }]}>{node.chapterName}</Text>
                  )}
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {(node.isStart || node.isFinish || node.isDetached) && (
                <View style={styles.badgeRow}>
                  {node.isStart && (
                    <View style={[styles.badge, { borderColor: colors.accent }]}>
                      <Text style={[styles.badgeText, { color: colors.accent }]}>{t('story_map_badge_start')}</Text>
                    </View>
                  )}
                  {node.isFinish && (
                    <View style={[styles.badge, { borderColor: colors.error }]}>
                      <Text style={[styles.badgeText, { color: colors.error }]}>{t('story_map_badge_finish')}</Text>
                    </View>
                  )}
                  {node.isDetached && (
                    <View style={[styles.badge, { borderColor: colors.border }]}>
                      <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{t('story_map_badge_detached')}</Text>
                    </View>
                  )}
                </View>
              )}

              <ScrollView>
                {!!node.scene.summary && (
                  <>
                    <Text style={styles.sectionTitle}>{t('summary')}</Text>
                    <Text style={styles.summary}>{node.scene.summary}</Text>
                  </>
                )}

                <Text style={styles.sectionTitle}>{t('story_map_outgoing_choices')}</Text>
                {renderConnections(outgoing, t('story_map_no_outgoing_choices'), 'arrow-forward')}

                <Text style={styles.sectionTitle}>{t('story_map_incoming_choices')}</Text>
                {renderConnections(incoming, t('story_map_no_incoming_choices'), 'arrow-back')}

                <TouchableOpacity style={styles.openButton} onPress={() => onOpenScene(node.id)}>
                  <Ionicons name="open-outline" size={18} color={colors.onPrimary} />
                  <Text style={styles.openButtonText}>{t('story_map_open_scene')}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default SceneNodeSheet;
