import { Ionicons } from '@expo/vector-icons';
import type { BoardContentType, BoardNodeType } from '@keres/shared';
import { generateBoardLocalId } from '@keres/shared';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { getCommonCardStyles } from '../../../theme/commonStyles';
import { useTheme } from '../../../theme';
import { boardPinTypeKey } from '../../../utils/boardPinAppearance';

interface Props {
  node: BoardNodeType;
  title: string;
  typeLabel: string;
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
  typeLabel,
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
  const noteTitleFromNode = node.kind === 'note' ? node.title : '';
  const noteBodyFromNode = node.kind === 'note' ? (node.body ?? '') : '';
  const [connectTo, setConnectTo] = useState<string | null>(null);
  const [directed, setDirected] = useState(true);
  const [edgeLabel, setEdgeLabel] = useState('');
  const [noteTitle, setNoteTitle] = useState(noteTitleFromNode);
  const [noteBody, setNoteBody] = useState(noteBodyFromNode);

  useEffect(() => {
    setConnectTo(null);
    setDirected(true);
    setEdgeLabel('');
    setNoteTitle(noteTitleFromNode);
    setNoteBody(noteBodyFromNode);
  }, [node.id, noteBodyFromNode, noteTitleFromNode]);

  const edges = content.edges.filter((edge) => edge.from === node.id || edge.to === node.id);
  const others = content.nodes.filter((item) => item.id !== node.id);
  const connectOptions = others.map((item) => ({
    label: nodeTitles[item.id] ?? item.id,
    value: item.id,
  }));

  const cardStyles = useMemo(() => getCommonCardStyles(colors), [colors]);
  const noteDirty = node.kind === 'note' && (noteTitle !== noteTitleFromNode || noteBody !== noteBodyFromNode);
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
          overflow: 'visible',
        },
        scroll: { flexGrow: 1 },
        scrollContent: {
          paddingHorizontal: 2,
          paddingVertical: 2,
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
        headerText: { flex: 1, marginRight: 12 },
        headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        saveButton: { paddingVertical: 8, paddingHorizontal: 14 },
        title: { fontSize: 19, fontWeight: 'bold', color: colors.text },
        typeLine: {
          fontSize: 13,
          color: colors.textSecondary,
          marginTop: 2,
          textTransform: 'uppercase',
          fontWeight: '600',
        },
        ghost: { color: colors.error, marginTop: 8, fontSize: 13 },
        openRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 12,
          paddingVertical: 8,
        },
        openText: { color: colors.primary, fontSize: 15, fontWeight: '600', marginLeft: 6 },
        section: {
          fontSize: 13,
          fontWeight: 'bold',
          color: colors.text,
          marginTop: 18,
          marginBottom: 8,
          textTransform: 'uppercase',
        },
        cardTitle: { marginBottom: 10 },
        item: {
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 8,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: 10,
          marginBottom: 6,
          backgroundColor: colors.surface,
        },
        itemText: { flex: 1, color: colors.text, fontSize: 13 },
        itemMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
        field: {
          marginBottom: 10,
          paddingHorizontal: 2,
          paddingVertical: 2,
        },
        switchRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        },
        hint: { color: colors.textSecondary, fontSize: 13, marginBottom: 10 },
        addButton: { marginTop: 4 },
        removeButton: { marginTop: 16, backgroundColor: colors.error },
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
    setDirected(true);
  };

  const typeKey = boardPinTypeKey(node.kind, node.kind === 'entity' ? node.entityType : undefined);

  return (
    <ResponsiveModal visible onClose={onClose} placement="adaptive" contentStyle={styles.sheet}>
      <View style={styles.handle} />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.typeLine}>{typeLabel || t(typeKey)}</Text>
        </View>
        <View style={styles.headerActions}>
          {node.kind === 'note' && canEdit && (
            <Button
              disabled={!noteDirty}
              onPress={() => onChangeNote(noteTitle, noteBody.trim() || null)}
              style={styles.saveButton}
            >
              {t('save')}
            </Button>
          )}
          <TouchableOpacity onPress={onClose} accessibilityLabel={t('close')}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
      {ghost && <Text style={styles.ghost}>{t('board_deleted_entity')}</Text>}

      {node.kind === 'entity' && !ghost && (
        <TouchableOpacity style={styles.openRow} onPress={onOpenEntity}>
          <Ionicons name="open-outline" size={18} color={colors.primary} />
          <Text style={styles.openText}>{t('board_open_entity')}</Text>
        </TouchableOpacity>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
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
          </>
        )}

        <View style={cardStyles.cardContainer}>
          <Text style={[cardStyles.cardText, styles.cardTitle]}>{t('board_edges')}</Text>
          {edges.length === 0 ? (
            <Text style={styles.hint}>{t('board_edges_empty')}</Text>
          ) : (
            edges.map((edge) => {
              const outgoing = edge.from === node.id;
              const otherId = outgoing ? edge.to : edge.from;
              const arrow = edge.directed ? (outgoing ? '→' : '←') : '—';
              return (
                <View key={edge.id} style={styles.item}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemText}>
                      {arrow} {nodeTitles[otherId] ?? otherId}
                    </Text>
                    {!!edge.label && <Text style={styles.itemMeta}>{edge.label}</Text>}
                  </View>
                  {canEdit && (
                    <TouchableOpacity
                      onPress={() => removeEdge(edge.id)}
                      accessibilityLabel={t('delete')}
                    >
                      <Ionicons name="close-circle" size={18} color={colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}

          {canEdit && others.length > 0 && (
            <>
              <Text style={styles.hint}>{t('board_connect_hint')}</Text>
              <MultiSelectPill
                options={connectOptions}
                selectedValues={connectTo ? [connectTo] : []}
                onSelectionChange={(values) => setConnectTo(values[0] ?? null)}
                singleSelect
                placeholder={t('board_connect_pick')}
              />
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
              <Button disabled={!connectTo} onPress={addEdge} style={styles.addButton}>
                {t('board_add_edge')}
              </Button>
            </>
          )}
        </View>

        {canEdit && (
          <Button onPress={removeNode} style={styles.removeButton}>
            {t('board_remove_node')}
          </Button>
        )}
      </ScrollView>
    </ResponsiveModal>
  );
};

export default BoardNodeSheet;
