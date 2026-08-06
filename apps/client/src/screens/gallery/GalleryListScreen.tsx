import { Ionicons } from '@expo/vector-icons';
import { MEDIA_TYPES } from '@keres/shared';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import GenericFilterSortList from '../../components/common/GenericFilterSortList/GenericFilterSortList';
import { ScreenError } from '../../components/common/ScreenState/ScreenState';
import GalleryGridItem from '../../components/listitem/GalleryGridItem';
import { useDrizzle } from '../../db';
import { GallerySelect } from '../../db/schemas/galleries';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityListScreen } from '../../hooks/useEntityListScreen';
import { GalleryStackParamList, MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { importPickedMediaAssets } from '../../services/galleryMediaImport';
import { mediaFileService } from '../../services/MediaFileService';
import { createGalleryService } from '../../services/storymanagement/GalleryService';
import { useGalleryStore } from '../../state/galleryStore';
import { useNotificationStore } from '../../state/notificationStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';

export type GalleryScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'GalleryStack'>,
  NativeStackNavigationProp<GalleryStackParamList, 'GalleryList'>
>;

const GalleryListScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<GalleryScreenNavigationProp>();
  const db = useDrizzle();
  const { userId } = useUserSettingsStore();
  const { showNotification } = useNotificationStore();

  /** Importar mídia é I/O de arquivo, não instantâneo; sem isto a tela pareceria travada. */
  const [importing, setImporting] = useState(false);

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

  /**
   * Importa os arquivos escolhidos.
   *
   * Mídia já presente na história (mesmo hash) não vira um registro novo: o endereçamento
   * por conteúdo torna a duplicata detectável, e criar outra linha só encheria a galeria de
   * cópias da mesma imagem.
   */
  const handleAddMedia = useCallback(async () => {
    if (!storyId || !userId) {
      showNotification(t('no_story_selected'), 'warning');
      return;
    }

    let assets;
    try {
      assets = await mediaFileService.pick();
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
  }, [storyId, userId, db, showNotification, t, refetch]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: t('gallery_title'),
        headerRight: () => (
          <TouchableOpacity onPress={handleAddMedia} style={{ marginRight: 15 }} disabled={importing}>
            {importing
              ? <ActivityIndicator size="small" color={colors.text} />
              : <Ionicons name="add" size={30} color={colors.text} />}
          </TouchableOpacity>
        ),
      });
    }, [navigation, colors.text, t, handleAddMedia, importing])
  );

  const handleViewDetails = useCallback((galleryId: string) => {
    navigation.navigate('GalleryDetail', { galleryId });
  }, [navigation]);

  const handleToggleFavorite = useCallback(async (galleryId: string, isFavorite: boolean) => {
    await toggleFavorite(galleryId, isFavorite);
  }, [toggleFavorite]);

  const renderGalleryItem = useCallback(({ item }: { item: GallerySelect }) => (
    <GalleryGridItem media={item} onPress={handleViewDetails} onToggleFavorite={handleToggleFavorite} />
  ), [handleViewDetails, handleToggleFavorite]);

  const mediaTypeOptions = useMemo(
    () => MEDIA_TYPES.map((type) => ({ label: t(`media_type_${type}`), value: type })),
    [t]
  );

  const sortOptions = useMemo(() => [
    { label: t('sort_by_created_at'), value: 'createdAt' },
    { label: t('sort_by_title'), value: 'title' },
    { label: t('sort_by_file_name'), value: 'fileName' },
    { label: t('sort_by_size'), value: 'sizeBytes' },
    { label: t('sort_by_updated_at'), value: 'updatedAt' },
  ], [t]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    columnWrapper: {
      paddingHorizontal: 5,
    },
  });

  if (error) {
    return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <View style={styles.container}>
      <GenericFilterSortList
        data={galleries}
        renderItem={renderGalleryItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
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
