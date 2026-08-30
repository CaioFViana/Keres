import { AppAlert } from '../../../utils/AppAlert';

export type GalleryAddKind = 'playable' | 'document' | 'link';

/**
 * Asks whether the next gallery item is playable media, a document, or a URL.
 *
 * The three paths do not share a picker: images/video/audio go through the playable MIME filter,
 * documents through a document filter, and a link is typed rather than chosen from disk.
 */
export function promptGalleryAddKind(
  t: (key: string) => string,
  onPick: (kind: GalleryAddKind) => void,
): void {
  AppAlert.alert(t('gallery_add_title'), t('gallery_add_message'), [
    { text: t('gallery_add_playable'), onPress: () => onPick('playable') },
    { text: t('gallery_add_document'), onPress: () => onPick('document') },
    { text: t('gallery_add_link'), onPress: () => onPick('link') },
    { text: t('cancel'), style: 'cancel' },
  ]);
}
