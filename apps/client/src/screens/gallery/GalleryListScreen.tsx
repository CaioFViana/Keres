import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { commonScreenStyleDefs } from '../../theme/commonStyles';
import { MEDIA_TYPES } from '@keres/shared';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import GenericFilterSortList from '@/src/components/common/lists/GenericFilterSortList/GenericFilterSortList';
import { ScreenError } from '@/src/components/common/feedback/ScreenState/ScreenState';
import GalleryAddLinkModal from '@/src/components/features/gallery/GalleryAddLinkModal';
import { promptGalleryAddKind } from '@/src/components/features/gallery/promptGalleryAddKind';
import GalleryGridItem from '@/src/components/features/list-items/GalleryGridItem';
import { useDrizzle } from '../../db';
import type { GallerySelect } from '../../db/schemas/galleries';
import { useScreenAnchor } from '../../guides/useGuideAnchor';
import { useNavigateAcrossStacks } from '@/src/hooks/useNavigateAcrossStacks';
import { useScreenTour } from '../../guides/useScreenTour';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityListScreen } from '../../hooks/useEntityListScreen';
import { useStoryRole } from '../../hooks/useStoryRole';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import type {
  GalleryStackParamList,
  MainSystemDrawerParamList,
} from '../../navigation/MainSystemStack';
import {
  GALLERY_ROW_PADDING,
  galleryGridLayout,
  galleryScrollbarWidth,
} from '../../utils/galleryGridLayout';
import { createGalleryLink } from '../../services/galleryLink';
import { importPickedMediaAssets } from '../../services/galleryMediaImport';
import { mediaFileService } from '../../services/MediaFileService';
import { createGalleryService } from '../../services/storymanagement/GalleryService';
import { useGalleryStore } from '../../state/galleryStore';
import { useNotificationStore } from '../../state/notificationStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { type ThemeColors } from '../../theme';
import { useThemedStyles } from '../../theme/useThemedStyles';

export type GalleryScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'GalleryStack'>,
  NativeStackNavigationProp<GalleryStackParamList, 'GalleryList'>
>;

const GalleryListScreen = () => {
  useBackButtonHandler();
  useScreenTour('GalleryStack');
  const listAnchorRef = useScreenAnchor('Gallery', 'list');
  const { t } = useTranslation();
  const { breakpoint } = useResponsiveLayout();
  const navigation = useNavigation<GalleryScreenNavigationProp>();
  const navigateAcross = useNavigateAcrossStacks();
  const db = useDrizzle();
  const { userId } = useUserSettingsStore();
  const { showNotification } = useNotificationStore();

  /** Importing media is file I/O, not instantaneous; without this the screen would look frozen. */
  const [importing, setImporting] = useState(false);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [listWidth, setListWidth] = useState(0);
  const listWidthRef = useRef(0);
  // The room a scrollbar takes from the list, for the list width and number of tiles it was measured
  // with. Kept while those hold: reserving it makes the tiles shorter, which could remove the scrollbar
  // and bring it back in turn. A different width or number of tiles (a search, say) measures anew.
  const [scrollbar, setScrollbar] = useState({ forKey: '', width: 0 });
  const scrollbarKeyRef = useRef('');

  const handleListLayout = useCallback((event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    listWidthRef.current = width;
    setListWidth(width);
  }, []);

  const handleContentWidth = useCallback((contentWidth: number) => {
    const measured = galleryScrollbarWidth(listWidthRef.current, contentWidth);
    if (measured > 0) setScrollbar({ forKey: scrollbarKeyRef.current, width: measured });
  }, []);

  const {
    listProps,
    items: galleries,
    error,
    storyId,
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

      // The picker covers the app with a native activity: an open drawer would be revealed
      // mid-transition on return, so it is put away on both sides of the flow. A no-op when
      // already closed.
      navigation.dispatch(DrawerActions.closeDrawer());
      try {
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
      } finally {
        navigation.dispatch(DrawerActions.closeDrawer());
      }
    },
    [storyId, userId, db, navigation, showNotification, t, refetch],
  );

  const handleAddLink = useCallback(
    async (url: string, title: string | null) => {
      if (!storyId || !userId) {
        showNotification(t('no_story_selected'), 'warning');
        return;
      }
      setImporting(true);
      try {
        const result = await createGalleryLink(
          createGalleryService(db),
          storyId,
          userId,
          url,
          title,
        );
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

  const handleOpenSketches = useCallback(() => {
    navigateAcross('SketchStack', 'SketchList');
  }, [navigateAcross]);

  const handleOpenSongs = useCallback(() => {
    navigateAcross('SongStack', 'SongList');
  }, [navigateAcross]);

  useScreenHeader({
    target: 'parent',
    title: t('gallery_title'),
    actions: [
      {
        id: 'sketches',
        icon: 'brush-outline',
        label: t('sketches_title'),
        onPress: handleOpenSketches,
        visible: true,
      },
      {
        id: 'songs',
        icon: 'musical-note-outline',
        label: t('songs_title'),
        onPress: handleOpenSongs,
        visible: true,
      },
      {
        id: 'add',
        icon: 'add',
        label: t('add'),
        onPress: handleAddMedia,
        visible: canEdit,
        busy: importing,
      },
    ],
  });

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

  // Before the list has been measured the window's breakpoint stands in for its width.
  const scrollbarKey = `${listWidth}:${galleries.length}`;
  scrollbarKeyRef.current = scrollbarKey;
  const grid =
    listWidth > 0
      ? galleryGridLayout(listWidth, scrollbar.forKey === scrollbarKey ? scrollbar.width : 0)
      : null;
  const numColumns =
    grid?.numColumns ?? (breakpoint === 'wide' ? 5 : breakpoint === 'medium' ? 3 : 2);
  const cardWidth = grid?.cardWidth;

  const renderGalleryItem = useCallback(
    ({ item }: { item: GallerySelect }) => (
      <GalleryGridItem
        media={item}
        width={cardWidth}
        onPress={handleViewDetails}
        onToggleFavorite={handleToggleFavorite}
      />
    ),
    [cardWidth, handleViewDetails, handleToggleFavorite],
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

  const styles = useThemedStyles(createStyles);

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
      <View
        ref={listAnchorRef}
        testID="gallery-list-area"
        collapsable={false}
        style={{ flex: 1 }}
        onLayout={handleListLayout}
      >
        <GenericFilterSortList
          {...listProps}
          key={`gallery-columns-${numColumns}`}
          data={galleries}
          renderItem={renderGalleryItem}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          onContentWidthChange={handleContentWidth}
          columnWrapperStyle={styles.columnWrapper}
          searchPlaceholder={t('search_media')}
          filterOptions={mediaTypeOptions}
          filterPlaceholder={t('filter_by_media_type')}
          sortOptions={sortOptions}
          entityName="Gallery"
          storyId={storyId || ''}
          emptyStateTitle={t('galleries_empty_title')}
          emptyStateMessage={t('galleries_empty_message')}
          emptyStateActions={
            canEdit
              ? [
                  {
                    label: t('galleries_empty_create'),
                    onPress: handleAddMedia,
                    testID: 'empty-create-gallery',
                  },
                ]
              : []
          }
        />
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    columnWrapper: {
      paddingHorizontal: GALLERY_ROW_PADDING,
    },
  });

export default GalleryListScreen;
