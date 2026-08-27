import { Ionicons } from '@expo/vector-icons';
import { commonScreenStyleDefs } from '../../theme/commonStyles';
import { MEDIA_TYPES } from '@keres/shared';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import GenericFilterSortList from '@/src/components/common/lists/GenericFilterSortList/GenericFilterSortList';
import { ScreenError } from '@/src/components/common/feedback/ScreenState/ScreenState';
import GalleryAddLinkModal from '@/src/components/features/gallery/GalleryAddLinkModal';
import { promptGalleryAddKind } from '@/src/components/features/gallery/promptGalleryAddKind';
import GalleryGridItem from '@/src/components/features/list-items/GalleryGridItem';
import { useDrizzle } from '../../db';
import type { GallerySelect } from '../../db/schemas/galleries';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityListScreen } from '../../hooks/useEntityListScreen';
import { useStoryRole } from '../../hooks/useStoryRole';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import type {
  GalleryStackParamList,
  MainSystemDrawerParamList,
} from '../../navigation/MainSystemStack';
import { createGalleryLink } from '../../services/galleryLink';
import { importPickedMediaAssets } from '../../services/galleryMediaImport';
import { mediaFileService } from '../../services/MediaFileService';
import { createGalleryService } from '../../services/storymanagement/GalleryService';
import { useGalleryStore } from '../../state/galleryStore';
import { useNotificationStore } from '../../state/notificationStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { setDocumentTitle } from '../../utils/documentTitle';

export type GalleryScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'GalleryStack'>,
  NativeStackNavigationProp<GalleryStackParamList, 'GalleryList'>
>;

const GalleryListScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { breakpoint } = useResponsiveLayout();
  const navigation = useNavigation<GalleryScreenNavigationProp>();
  const db = useDrizzle();
  const { userId } = useUserSettingsStore();
  const { showNotification } = useNotificationStore();

  /** Importing media is file I/O, not instantaneous; without this the screen would look frozen. */
  const [importing, setImporting] = useState(false);
  const [linkModalVisible, setLinkModalVisible] = useState(false);

  const {
    items: galleries,
    loading,
    error,
    storyId,
    searchQuery,
    activeSort,
    sortDirection,
    favoriteFilterState,
    activeFilterTags,
    handleSearch,
    handleSearchSubmit,
    handleSortChange,
    handleSortDirectionChange,
    handleFavoriteFilterChange,
    handleFilterTagsChange,
    toggleFavorite,
    refetch,
  } = useEntityListScreen({
    useStore: useGalleryStore,
    collectionKey: 'galleries',
    changeEvent: 'gallery_changed',
  });

  const { canEdit } = useStoryRole(storyId);

  /**
   * Imports the chosen files.
   *
   * Media already present in the story (the same hash) does not become a new record: content addressing
   * makes the duplicate detectable, and creating another row would only fill the gallery with copies of
   * the same image.
   */
  const importFromPicker = useCallback(
    async (picker: () => Promise<Awaited<ReturnType<typeof mediaFileService.pick>>>) => {
      if (!storyId || !userId) {
        showNotification(t('no_story_selected'), 'warning');
        return;
      }

      let assets;
      try {
        assets = await picker();
      } catch (pickError) {
        console.log('Media picker failed:', pickError);
        showNotification(t('media_picker_failed'), 'error');
        return;
      }

      if (!assets) {
        return;
      }

      setImporting(true);
      const galleryService = createGalleryService(db);
      const summary = await importPickedMediaAssets(galleryService, storyId, userId, assets);
      setImporting(false);

      if (summary.added > 0) {
        showNotification(t('media_added_successfully', { count: summary.added }), 'success');
      }
      if (summary.duplicates > 0) {
        showNotification(t('media_already_in_gallery', { count: summary.duplicates }), 'info');
      }
      if (summary.rejected > 0) {
        showNotification(t('media_unsupported_skipped', { count: summary.rejected }), 'warning');
      }

      await refetch();
    },
    [storyId, userId, db, showNotification, t, refetch],
  );

  const handleAddLink = useCallback(
    async (url: string, title: string | null) => {
      if (!storyId || !userId) {
        showNotification(t('no_story_selected'), 'warning');
        return;
      }
      setImporting(true);
      try {
        const result = await createGalleryLink(createGalleryService(db), storyId, userId, url, title);
        if (!result) {
          showNotification(t('gallery_link_invalid'), 'warning');
          return;
        }
        if (result.duplicate) {
          showNotification(t('media_already_in_gallery', { count: 1 }), 'info');
        } else {
          showNotification(t('media_added_successfully', { count: 1 }), 'success');
        }
        await refetch();
      } catch (linkError) {
        console.log('Failed to add gallery link:', linkError);
        showNotification(t('media_save_failed'), 'error');
      } finally {
        setImporting(false);
      }
    },
    [storyId, userId, db, showNotification, t, refetch],
  );

  const handleAddMedia = useCallback(() => {
    promptGalleryAddKind(t, (kind) => {
      if (kind === 'playable') void importFromPicker(() => mediaFileService.pick());
      else if (kind === 'document') void importFromPicker(() => mediaFileService.pickDocuments());
      else setLinkModalVisible(true);
    });
  }, [importFromPicker, t]);

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(t('gallery_title'));
      navigation.getParent()?.setOptions({
        title: t('gallery_title'),
        headerRight: canEdit
          ? () => (
              <TouchableOpacity
                onPress={handleAddMedia}
                style={{ marginRight: 15 }}
                disabled={importing}
              >
                {importing ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <Ionicons name="add" size={30} color={colors.text} />
                )}
              </TouchableOpacity>
            )
          : undefined,
      });
    }, [navigation, colors.text, t, handleAddMedia, importing, canEdit]),
  );

  const handleViewDetails = useCallback(
    (galleryId: string) => {
      navigation.navigate('GalleryDetail', { galleryId });
    },
    [navigation],
  );

  const handleToggleFavorite = useCallback(
    async (galleryId: string, isFavorite: boolean) => {
      await toggleFavorite(galleryId, isFavorite);
    },
    [toggleFavorite],
  );

  const renderGalleryItem = useCallback(
    ({ item }: { item: GallerySelect }) => (
      <GalleryGridItem
        media={item}
        onPress={handleViewDetails}
        onToggleFavorite={handleToggleFavorite}
      />
    ),
    [handleViewDetails, handleToggleFavorite],
  );

  const mediaTypeOptions = useMemo(
    () => MEDIA_TYPES.map((type) => ({ label: t(`media_type_${type}`), value: type })),
    [t],
  );

  const sortOptions = useMemo(
    () => [
      { label: t('sort_by_created_at'), value: 'createdAt' },
      { label: t('sort_by_title'), value: 'title' },
      { label: t('sort_by_file_name'), value: 'fileName' },
      { label: t('sort_by_size'), value: 'sizeBytes' },
      { label: t('sort_by_updated_at'), value: 'updatedAt' },
    ],
    [t],
  );

  const numColumns = breakpoint === 'wide' ? 5 : breakpoint === 'medium' ? 3 : 2;

  const styles = StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    columnWrapper: {
      paddingHorizontal: 5,
    },
  });

  if (error) {
    return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <View style={styles.container}>
      <GalleryAddLinkModal
        visible={linkModalVisible}
        onCancel={() => setLinkModalVisible(false)}
        onConfirm={(url, title) => {
          setLinkModalVisible(false);
          void handleAddLink(url, title);
        }}
      />
      <GenericFilterSortList
        key={`gallery-columns-${numColumns}`}
        data={galleries}
        renderItem={renderGalleryItem}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        columnWrapperStyle={styles.columnWrapper}
        onSearch={handleSearch}
        onSearchSubmit={handleSearchSubmit}
        searchPlaceholder={t('search_media')}
        currentSearchTerm={searchQuery}
        filterOptions={mediaTypeOptions}
        onFilterChange={handleFilterTagsChange}
        selectedFilterValues={activeFilterTags}
        sortOptions={sortOptions}
        onSortChange={handleSortChange}
        onSortDirectionChange={handleSortDirectionChange}
        currentSortDirection={sortDirection}
        currentSortValue={activeSort}
        onFavoriteFilterChange={handleFavoriteFilterChange}
        currentFavoriteFilterState={favoriteFilterState}
        entityName="Gallery"
        storyId={storyId || ''}
        isLoading={loading}
      />
    </View>
  );
};

export default GalleryListScreen;
