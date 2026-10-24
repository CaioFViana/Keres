import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { getEntityAppearance } from '@keres/shared';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { ScreenError } from '@/src/components/common/feedback/ScreenState/ScreenState';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import CanvasListRow from '@/src/components/features/canvas/CanvasListRow';
import LocationMapCreateModal from '@/src/components/features/location-maps/LocationMapCreateModal';
import { useDrizzle } from '@/src/db';
import { useStoryList } from '@/src/hooks/lists/useStoryEntities';
import type { LocationMapSelect } from '@/src/db/schema';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import { useConfirmDelete } from '@/src/hooks/ui/useConfirmDelete';
import { useStoryRole } from '@/src/hooks/story/useStoryRole';
import { filterByNameAndDescription } from '@/src/utils/search/filterByNameAndDescription';
import type {
  LocationStackParamList,
  MainSystemDrawerParamList,
} from '@/src/navigation/drawer/MainSystemDrawer';
import { createLocationMapService } from '@/src/services/storymanagement/entities/LocationMapService';
import { useNotificationStore } from '@/src/state/ui/notificationStore';
import { useStoryStore } from '@/src/state/story/storyStore';
import { useUserSettingsStore } from '@/src/state/app/userSettingsStore';
import { type ThemeColors } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import { commonScreenStyleDefs } from '@/src/theme/commonStyles';
import { AppAlert } from '@/src/state/ui/AppAlert';
import { logger } from '@/src/utils/logging/logger';

const MAP_EVENTS = ['location_map_changed'] as const;

type Navigation = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'LocationsStack'>,
  NativeStackNavigationProp<LocationStackParamList, 'LocationMapList'>
>;

const LocationMapListScreen = () => {
  const { t } = useTranslation();
  const mapAppearance = getEntityAppearance('LocationMap');
  const navigation = useNavigation<Navigation>();
  useBackButtonHandler({
    showWebBackButton: true,
    onBack: () => navigation.goBack(),
  });
  const db = useDrizzle();
  const storyId = useStoryStore((state) => state.selectedStory?.id);
  const { canEdit } = useStoryRole(storyId);
  const { userId } = useUserSettingsStore();
  const { showNotification } = useNotificationStore();
  const confirmDelete = useConfirmDelete();
  const [createVisible, setCreateVisible] = useState(false);
  const [editingMap, setEditingMap] = useState<LocationMapSelect | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const listService = useMemo(() => createLocationMapService(db), [db]);
  const {
    items: maps,
    failed,
    reload,
  } = useStoryList({
    storyId,
    load: listService.getMapsForStory,
    events: MAP_EVENTS,
    label: 'maps',
  });
  const error = failed ? t('location_map_load_failed') : null;

  useScreenHeader({
    target: 'parent',
    title: t('location_map_list_title'),
    actions: [
      {
        id: 'action-0',
        icon: 'add',
        label: t('location_map_create_title'),
        onPress: () => setCreateVisible(true),
        visible: !!canEdit,
      },
    ],
  });

  const styles = useThemedStyles(createStyles);

  const filteredMaps = useMemo(
    () => filterByNameAndDescription(maps, searchQuery),
    [maps, searchQuery],
  );

  if (error) {
    return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;
  }

  const confirmDuplicateMap = (item: LocationMapSelect) => {
    AppAlert.alert(t('location_map_duplicate_title'), t('location_map_duplicate_message'), [
      {
        text: t('confirm'),
        onPress: async () => {
          if (!userId || !storyId) return;
          try {
            await createLocationMapService(db).createMap(userId, {
              storyId,
              name: t('location_map_copy_name', { name: item.name }),
              description: item.description,
              content: item.content,
            });
            await reload();
          } catch (duplicateError) {
            logger.debug('LocationMapListScreen: failed to duplicate map.', duplicateError);
            showNotification(t('location_map_save_failed'), 'error');
          }
        },
      },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };
  const confirmMapDelete = (item: LocationMapSelect) =>
    confirmDelete({
      titleKey: 'location_map_delete_title',
      messageKey: 'location_map_delete_message',
      onConfirm: async () => {
        if (!userId) return;
        await createLocationMapService(db).deleteMap(userId, item.id);
        await reload();
      },
      failureKey: 'location_map_save_failed',
    });
  const updateMapDetails = async (name: string, description: string | null) => {
    if (!editingMap || !userId) return;
    try {
      await createLocationMapService(db).updateMap(userId, editingMap.id, { name, description });
      setEditingMap(null);
      await reload();
    } catch (updateError) {
      logger.debug('LocationMapListScreen: failed to update map details.', updateError);
      showNotification(t('location_map_save_failed'), 'error');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('location_map_search_placeholder')}
          accessibilityLabel={t('location_map_search_placeholder')}
        />
      </View>
      <FlatList
        data={filteredMaps}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {searchQuery.trim()
              ? t('location_map_search_no_results')
              : t('location_map_list_empty')}
          </Text>
        }
        renderItem={({ item }) => (
          <CanvasListRow
            leading={
              <Ionicons
                name={mapAppearance.icon as keyof typeof Ionicons.glyphMap}
                size={24}
                color={mapAppearance.color}
                style={{ marginRight: 12 }}
              />
            }
            name={item.name}
            description={item.description}
            canEdit={!!canEdit}
            onPress={() => navigation.navigate('LocationMap', { mapId: item.id })}
            onEdit={() => setEditingMap(item)}
            onDuplicate={() => confirmDuplicateMap(item)}
            onDelete={() => confirmMapDelete(item)}
          />
        )}
      />
      <LocationMapCreateModal
        visible={createVisible}
        onCancel={() => setCreateVisible(false)}
        onConfirm={async (name, description) => {
          if (!storyId || !userId) return;
          setCreateVisible(false);
          try {
            const created = await createLocationMapService(db).createMap(userId, {
              storyId,
              name,
              description,
              content: { images: [], nodes: [] },
            });
            navigation.navigate('LocationMap', { mapId: created.id });
          } catch (createError) {
            logger.debug('LocationMapListScreen: failed to create a map.', createError);
            showNotification(t('location_map_save_failed'), 'error');
          }
        }}
      />
      <LocationMapCreateModal
        visible={!!editingMap}
        initialValues={editingMap ?? undefined}
        title={t('edit')}
        confirmLabel={t('save')}
        onCancel={() => setEditingMap(null)}
        onConfirm={(name, description) => void updateMapDetails(name, description)}
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

export default LocationMapListScreen;
