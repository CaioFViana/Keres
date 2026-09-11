import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { getEntityAppearance } from '@keres/shared';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ScreenError } from '@/src/components/common/feedback/ScreenState/ScreenState';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import LocationMapCreateModal from '@/src/components/features/location-maps/LocationMapCreateModal';
import { useDrizzle } from '../../db';
import type { LocationMapSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import { useStoryRole } from '../../hooks/useStoryRole';
import type {
  LocationStackParamList,
  MainSystemDrawerParamList,
} from '../../navigation/MainSystemStack';
import { createLocationMapService } from '../../services/storymanagement/LocationMapService';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { commonScreenStyleDefs } from '../../theme/commonStyles';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { AppAlert } from '../../utils/AppAlert';

type Navigation = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'LocationsStack'>,
  NativeStackNavigationProp<LocationStackParamList, 'LocationMapList'>
>;

const LocationMapListScreen = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
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
  const [maps, setMaps] = useState<LocationMapSelect[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [editingMap, setEditingMap] = useState<LocationMapSelect | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const reload = useCallback(async () => {
    if (!storyId) {
      setMaps([]);
      return;
    }
    try {
      setMaps(await createLocationMapService(db).getMapsForStory(storyId));
      setError(null);
    } catch (loadError) {
      console.log('LocationMapListScreen: failed to load maps.', loadError);
      setError(t('location_map_load_failed'));
    }
  }, [db, storyId, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onChange = (changedStoryId: string) => {
      if (changedStoryId === storyId) void reload();
    };
    entityEventEmitter.on('location_map_changed', onChange);
    return () => entityEventEmitter.off('location_map_changed', onChange);
  }, [reload, storyId]);

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

  const filteredMaps = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return maps;
    return maps.filter(({ name, description }) =>
      `${name} ${description ?? ''}`.toLocaleLowerCase().includes(query),
    );
  }, [maps, searchQuery]);

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
            console.log('LocationMapListScreen: failed to duplicate map.', duplicateError);
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
      console.log('LocationMapListScreen: failed to update map details.', updateError);
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
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('LocationMap', { mapId: item.id })}
          >
            <Ionicons
              name={mapAppearance.icon as keyof typeof Ionicons.glyphMap}
              size={24}
              color={mapAppearance.color}
              style={styles.entityIcon}
            />
            <View style={styles.rowText}>
              <Text style={styles.name}>{item.name}</Text>
              {!!item.description && <Text style={styles.description}>{item.description}</Text>}
            </View>
            {canEdit && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setEditingMap(item)}
                accessibilityLabel={t('edit')}
              >
                <Ionicons name="pencil-outline" size={21} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
            {canEdit && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => confirmDuplicateMap(item)}
                accessibilityLabel={t('duplicate')}
              >
                <Ionicons name="copy-outline" size={21} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
            {canEdit && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => confirmMapDelete(item)}
                accessibilityLabel={t('delete')}
              >
                <Ionicons name="trash-outline" size={21} color={colors.error} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
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
            console.log('LocationMapListScreen: failed to create a map.', createError);
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

export default LocationMapListScreen;
