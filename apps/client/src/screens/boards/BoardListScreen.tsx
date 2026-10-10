import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { getEntityAppearance } from '@keres/shared';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { ScreenError } from '@/src/components/common/feedback/ScreenState/ScreenState';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import BoardCreateModal from '@/src/components/features/boards/BoardCreateModal';
import CanvasListRow from '@/src/components/features/canvas/CanvasListRow';
import { useDrizzle } from '../../db';
import type { BoardSelect } from '../../db/schema';
import { useScreenTour } from '../../guides/useScreenTour';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import { useStoryRole } from '../../hooks/useStoryRole';
import { filterByNameAndDescription } from '../../utils/filterByNameAndDescription';
import type {
  BoardStackParamList,
  MainSystemDrawerParamList,
} from '../../navigation/MainSystemStack';
import { createBoardService } from '../../services/storymanagement/BoardService';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { type ThemeColors } from '../../theme';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { commonScreenStyleDefs } from '../../theme/commonStyles';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { AppAlert } from '../../utils/AppAlert';
import GuideAnchor from '@/src/guides/GuideAnchor';

type Navigation = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'BoardsStack'>,
  NativeStackNavigationProp<BoardStackParamList, 'BoardList'>
>;

const BoardListScreen = () => {
  useBackButtonHandler();
  useScreenTour('BoardsStack');
  const { t } = useTranslation();
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `reload` clears synchronously only when no story is selected; everything else waits for `await`. The rule cannot verify across the callback boundary.
    void reload();
  }, [reload]);

  useEffect(() => {
    const onChange = (changedStoryId: string) => {
      if (changedStoryId === storyId) void reload();
    };
    entityEventEmitter.on('board_changed', onChange);
    return () => entityEventEmitter.off('board_changed', onChange);
  }, [reload, storyId]);

  useScreenHeader({
    target: 'parent',
    title: t('boards_title'),
    actions: [
      {
        id: 'action-0',
        icon: 'add',
        label: t('board_create_title'),
        onPress: () => setCreateVisible(true),
        visible: !!canEdit,
      },
    ],
  });

  const styles = useThemedStyles(createStyles);

  const filteredBoards = useMemo(
    () => filterByNameAndDescription(boards, searchQuery),
    [boards, searchQuery],
  );

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
      <GuideAnchor screen="Boards" part="list" style={{ flex: 1 }}>
        <FlatList
          data={filteredBoards}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {searchQuery.trim() ? t('board_search_no_results') : t('board_list_empty')}
            </Text>
          }
          renderItem={({ item }) => (
            <CanvasListRow
              leading={
                <Ionicons
                  name={boardAppearance.icon as keyof typeof Ionicons.glyphMap}
                  size={24}
                  color={boardAppearance.color}
                  style={{ marginRight: 12 }}
                />
              }
              name={item.name}
              description={item.description}
              canEdit={!!canEdit}
              onPress={() => navigation.navigate('BoardCanvas', { boardId: item.id })}
              onEdit={() => setEditingBoard(item)}
              onDuplicate={() => confirmDuplicateBoard(item)}
              onDelete={() => confirmBoardDelete(item)}
            />
          )}
        />
      </GuideAnchor>
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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    searchContainer: { padding: 10 },
    empty: {
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 32,
      paddingHorizontal: 24,
    },
  });

export default BoardListScreen;
