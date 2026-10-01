import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { useTranslation } from 'react-i18next';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import ShippedPacksContent from './ShippedPacksContent';

/**
 * Adapts `ShippedPacksContent` to real navigation: the catalogue reached from the pack list.
 * The "peek" coming from the story form uses `ShippedPacksInstallerOverlay`, which mounts the
 * same content without navigation - see the comment in `ShippedPacksContent.tsx` for why.
 */
const ShippedPacksScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  useScreenHeader({ target: 'parent', title: t('shipped_packs_title') });

  return <ShippedPacksContent />;
};

export default ShippedPacksScreen;
