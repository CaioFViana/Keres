import { Ionicons } from '@expo/vector-icons';
import type { BoardContentType, BoardNodeType } from '@keres/shared';
import { generateBoardLocalId } from '@keres/shared';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useTheme } from '../../../theme';

interface Props {
  node: BoardNodeType;
  title: string;
  ghost: boolean;
  content: BoardContentType;
  nodeTitles: Record<string, string>;
  canEdit: boolean;
  onClose: () => void;
  onChangeContent: (content: BoardContentType) => void;
  onOpenEntity: () => void;
  onChangeNote: (title: string, body: string | null) => void;
}

const BoardNodeSheet: React.FC<Props> = ({
  node,
  title,
  ghost,
  content,
  nodeTitles,
  canEdit,
  onClose,
  onChangeContent,
  onOpenEntity,
  onChangeNote,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [connectTo, setConnectTo] = useState<string | null>(null);
  const [directed, setDirected] = useState(false);
  const [edgeLabel, setEdgeLabel] = useState('');
  const [noteTitle, setNoteTitle] = useState(node.kind === 'note' ? node.title : '');
  const [noteBody, setNoteBody] = useState(node.kind === 'note' ? (node.body ?? '') : '');

  const edges = content.edges.filter((edge) => edge.from === node.id || edge.to === node.id);
  const others = content.nodes.filter((item) => item.id !== node.id);

  const styles = useMemo(
    () =>
      StyleSheet.create({
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
        header: { flexDirection: 'row', alignItems: 'flex-start' },
        title: { flex: 1, fontSize: 19, fontWeight: 'bold', color: colors.text, marginRight: 12 },
        section: {
          fontSize: 13,
          fontWeight: 'bold',
          color: colors.text,
          marginTop: 16,
          marginBottom: 6,
          textTransform: 'uppercase',
        },
        item: {
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 8,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: 10,
          marginBottom: 6,
        },
        itemText: { flex: 1, color: colors.text, fontSize: 13 },
        ghost: { color: colors.error, marginTop: 8, fontSize: 13 },
        field: { marginBottom: 10 },
        switchRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        },
        actions: { marginTop: 16, gap: 8 },
      }),
    [colors],
  );

  const removeNode = () => {
    onChangeContent({
      nodes: content.nodes.filter((item) => item.id !== node.id),
      edges: content.edges.filter((edge) => edge.from !== node.id && edge.to !== node.id),
    });
    onClose();
  };

  const removeEdge = (edgeId: string) => {
    onChangeContent({
      ...content,
      edges: content.edges.filter((edge) => edge.id !== edgeId),
    });
  };

  const addEdge = () => {
    if (!connectTo) return;
    const existing = new Set([
      ...content.nodes.map((item) => item.id),
      ...content.edges.map((edge) => edge.id),
    ]);
    onChangeContent({
      ...content,
      edges: [
        ...content.edges,
        {
          id: generateBoardLocalId(existing),
          from: node.id,
          to: connectTo,
          directed,
          label: edgeLabel.trim() || null,
        },
      ],
    });
    setConnectTo(null);
    setEdgeLabel('');
    setDirected(false);
  };

  return (
    <ResponsiveModal visible onClose={onClose} placement="adaptive" contentStyle={styles.sheet}>
      <View style={styles.handle} />
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      {ghost && <Text style={styles.ghost}>{t('board_deleted_entity')}</Text>}

      <ScrollView>
        {node.kind === 'note' && canEdit && (
          <>
            <Text style={styles.section}>{t('board_note')}</Text>
            <View style={styles.field}>
              <TextInput value={noteTitle} onChangeText={setNoteTitle} placeholder={t('title')} />
            </View>
            <View style={styles.field}>
              <TextInput
                value={noteBody}
                onChangeText={setNoteBody}
                placeholder={t('board_note_body')}
                multiline
              />
            </View>
            <Button onPress={() => onChangeNote(noteTitle, noteBody.trim() || null)}>
              {t('save')}
            </Button>
          </>
        )}

        <Text style={styles.section}>{t('board_edges')}</Text>
        {edges.length === 0 ? (
          <Text style={{ color: colors.textSecondary }}>{t('board_edges_empty')}</Text>
        ) : (
          edges.map((edge) => {
            const otherId = edge.from === node.id ? edge.to : edge.from;
            const arrow = edge.directed
              ? edge.from === node.id
                ? '→'
                : '←'
              : '—';
            return (
              <View key={edge.id} style={styles.item}>
                <Text style={styles.itemText}>
                  {arrow} {nodeTitles[otherId] ?? otherId}
                  {edge.label ? ` · ${edge.label}` : ''}
                </Text>
                {canEdit && (
                  <TouchableOpacity onPress={() => removeEdge(edge.id)}>
                    <Ionicons name="close-circle" size={18} color={colors.error} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}

        {canEdit && others.length > 0 && (
          <>
            <Text style={styles.section}>{t('board_connect')}</Text>
            {others.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.item,
                  connectTo === item.id && { borderColor: colors.primary, borderWidth: 2 },
                ]}
                onPress={() => setConnectTo(item.id)}
              >
                <Text style={styles.itemText}>{nodeTitles[item.id] ?? item.id}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.switchRow}>
              <Text style={{ color: colors.text }}>{t('board_edge_directed')}</Text>
              <ThemedSwitch value={directed} onValueChange={setDirected} />
            </View>
            <View style={styles.field}>
              <TextInput
                value={edgeLabel}
                onChangeText={setEdgeLabel}
                placeholder={t('board_edge_label')}
              />
            </View>
            <Button disabled={!connectTo} onPress={addEdge}>
              {t('board_add_edge')}
            </Button>
          </>
        )}

        <View style={styles.actions}>
          {node.kind === 'entity' && !ghost && (
            <Button onPress={onOpenEntity}>{t('board_open_entity')}</Button>
          )}
          {canEdit && (
            <Button onPress={removeNode}>{t('board_remove_node')}</Button>
          )}
        </View>
      </ScrollView>
    </ResponsiveModal>
  );
};

export default BoardNodeSheet;
