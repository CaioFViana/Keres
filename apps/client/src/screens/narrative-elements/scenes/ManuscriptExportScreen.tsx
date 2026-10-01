import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/src/components/common/controls/Button/Button';
import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import ManuscriptExportOptions from '../../../components/features/manuscript/ManuscriptExportOptions/ManuscriptExportOptions';
import { MANUSCRIPT_EXPORT_FORMATS } from '../../../components/features/manuscript/export/manuscriptExport';
import { defaultExportSettings } from '../../../components/features/manuscript/export/manuscriptExportSettings';
import { useBackButtonHandler } from '../../../hooks/useBackButtonHandler';
import { useScreenHeader } from '../../../hooks/useScreenHeader';
import { useManuscriptExport } from './useManuscriptExport';

/**
 * The manuscript export as a screen of its own, laid out like every form of the app: the title in
 * the native header (with its back control), every option the pipeline takes (the same component the
 * publish screen shows), then cancel and export at the end. A made file goes back to the manuscript;
 * a failure stays here with the choices intact.
 */
const ManuscriptExportScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { loading, exporting, isBranching, looseCount, arcs, storyAuthor, exportWith } =
    useManuscriptExport();
  const [settings, setSettings] = useState(() => defaultExportSettings(storyAuthor));
  useScreenHeader({ target: 'parent', title: t('export_manuscript_title') });

  if (loading) return <ScreenLoading message={t('loading')} padded />;

  const handleExport = async () => {
    if (await exportWith(settings)) navigation.goBack();
  };

  return (
    <EntityFormContainer
      width="reading"
      description={t('export_manuscript_description')}
      actions={
        <>
          <Button testID="export-cancel" onPress={() => navigation.goBack()}>
            {t('cancel')}
          </Button>
          <Button testID="export-confirm" onPress={() => void handleExport()} disabled={exporting}>
            {t('export_manuscript_export')}
          </Button>
        </>
      }
    >
      <ManuscriptExportOptions
        settings={settings}
        onChange={setSettings}
        formats={MANUSCRIPT_EXPORT_FORMATS}
        branching={isBranching}
        showLooseSwitch={!isBranching && looseCount > 0}
        looseCount={looseCount}
        chapterNumberingAvailable={!isBranching}
        arcs={arcs}
      />
    </EntityFormContainer>
  );
};

export default ManuscriptExportScreen;
