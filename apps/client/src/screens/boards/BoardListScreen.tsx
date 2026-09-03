import { Ionicons } from '@expo/vector-icons';
import { getEntityAppearance } from '@keres/shared';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ScreenError } from '@/src/components/common/feedback/ScreenState/ScreenState';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import BoardCreateModal from '@/src/components/features/boards/BoardCreateModal';
import { useDrizzle } from '../../db';
import type { BoardSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import { useStoryRole } from '../../hooks/useStoryRole';
import type {
  BoardStackParamList,
  MainSystemDrawerParamList,
} from '../../navigation/MainSystemStack';
import { createBoardService } from '../../services/storymanagement/BoardService';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { commonScreenStyleDefs } from '../../theme/commonStyles';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { setDocumentTitle } from '../../utils/documentTitle';
import { AppAlert } from '../../utils/AppAlert';

type Navigation = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'BoardsStack'>,
  NativeStackNavigationProp<BoardStackParamList, 'BoardList'>
>;

const BoardListScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const boardAppearance = getEntityAppearance('Board');
  const navigation = useNavigation<Navigation>();
  const db = useDrizzle();
  const storyId = useStoryStore((state) => state.selectedStory?.id);
  const { canEdit } = useStoryRole(storyId);
  const { userId } = useUserSettingsStore();
  const { showNotification } = useNotificationStore();
  const confirmDelete = useConfirmDelete();
  const [boards, setBoards] = useState<BoardSelect[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [editingBoard, setEditingBoard] = useState<BoardSelect | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const reload = useCallback(async () => {
    if (!storyId) {
      setBoards([]);
      return;
    }
    try {
      setBoards(await createBoardService(db).getBoardsForStory(storyId));
      setError(null);
    } catch (loadError) {
      console.log('BoardListScreen: failed to load boards.', loadError);
      setError(t('board_load_failed'));
    }
  }, [db, storyId, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onChange = (changedStoryId: string) => {
      if (changedStoryId === storyId) void reload();
    };
    entityEventEmitter.on('board_changed', onChange);
    return () => entityEventEmitter.off('board_changed', onChange);
  }, [reload, storyId]);

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(t('boards_title'));
      navigation.getParent()?.setOptions({
        title: t('boards_title'),
        headerRight: canEdit
          ? () => (
              <TouchableOpacity
                onPress={() => setCreateVisible(true)}
                style={{ marginRight: 15 }}
                accessibilityLabel={t('board_create_title')}
              >
                <Ionicons name="add" size={30} color={colors.text} />
              </TouchableOpacity>
            )
          : undefined,
      });
    }, [canEdit, colors.text, navigation, t]),
  );

  const styles = StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    searchContainer: { padding: 10 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowText: { flex: 1 },
    entityIcon: { marginRight: 12 },
    actionButton: { padding: 8, marginLeft: 4 },
    name: { fontSize: 16, fontWeight: '600', color: colors.text },
    description: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
    empty: {
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 32,
      paddingHorizontal: 24,
    },
  });

  const filteredBoards = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return boards;
    return boards.filter(({ name, description }) =>
      `${name} ${description ?? ''}`.toLocaleLowerCase().includes(query),
    );
  }, [boards, searchQuery]);

  if (error) {
    return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;
  }

  const confirmDuplicateBoard = (item: BoardSelect) => {
    AppAlert.alert(t('board_duplicate_title'), t('board_duplicate_message'), [
      {
        text: t('confirm'),
        onPress: async () => {
          if (!userId || !storyId) return;
          try {
            await createBoardService(db).createBoard(userId, {
              storyId,
              name: t('board_copy_name', { name: item.name }),
              description: item.description,
              content: item.content,
            });
            await reload();
          } catch (duplicateError) {
            console.log('BoardListScreen: failed to duplicate board.', duplicateError);
            showNotification(t('board_save_failed'), 'error');
          }
        },
      },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };
  const confirmBoardDelete = (item: BoardSelect) =>
    confirmDelete({
      titleKey: 'board_delete_title',
      messageKey: 'board_delete_message',
      onConfirm: async () => {
        if (!userId) return;
        await createBoardService(db).deleteBoard(userId, item.id);
        await reload();
      },
      failureKey: 'board_save_failed',
    });
  const updateBoardDetails = async (name: string, description: string | null) => {
    if (!editingBoard || !userId) return;
    try {
      await createBoardService(db).updateBoard(userId, editingBoard.id, { name, description });
      setEditingBoard(null);
      await reload();
    } catch (updateError) {
      console.log('BoardListScreen: failed to update board details.', updateError);
      showNotification(t('board_save_failed'), 'error');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('board_search_placeholder')}
          accessibilityLabel={t('board_search_placeholder')}
        />
      </View>
      <FlatList
        data={filteredBoards}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {searchQuery.trim() ? t('board_search_no_results') : t('board_list_empty')}
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('BoardCanvas', { boardId: item.id })}
          >
            <Ionicons
              name={boardAppearance.icon as keyof typeof Ionicons.glyphMap}
              size={24}
              color={boardAppearance.color}
              style={styles.entityIcon}
            />
            <View style={styles.rowText}>
              <Text style={styles.name}>{item.name}</Text>
              {!!item.description && <Text style={styles.description}>{item.description}</Text>}
            </View>
            {canEdit && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setEditingBoard(item)}
                accessibilityLabel={t('edit')}
              >
                <Ionicons name="pencil-outline" size={21} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
            {canEdit && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => confirmDuplicateBoard(item)}
                accessibilityLabel={t('duplicate')}
              >
                <Ionicons name="copy-outline" size={21} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
            {canEdit && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => confirmBoardDelete(item)}
                accessibilityLabel={t('delete')}
              >
                <Ionicons name="trash-outline" size={21} color={colors.error} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        )}
      />
      <BoardCreateModal
        visible={createVisible}
        onCancel={() => setCreateVisible(false)}
        onConfirm={async (name, description) => {
          if (!storyId || !userId) return;
          setCreateVisible(false);
          try {
            const created = await createBoardService(db).createBoard(userId, {
              storyId,
              name,
              description,
              content: { nodes: [], edges: [] },
            });
            navigation.navigate('BoardCanvas', { boardId: created.id });
          } catch (createError) {
            console.log('BoardListScreen: failed to create a board.', createError);
            showNotification(t('board_save_failed'), 'error');
          }
        }}
      />
      <BoardCreateModal
        visible={!!editingBoard}
        initialValues={editingBoard ?? undefined}
        title={t('edit')}
        confirmLabel={t('save')}
        onCancel={() => setEditingBoard(null)}
        onConfirm={(name, description) => void updateBoardDetails(name, description)}
      />
    </View>
  );
};

export default BoardListScreen;
