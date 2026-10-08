import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/src/components/common/controls/Button/Button';
import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import ManuscriptExportOptions from '../../../components/features/manuscript/ManuscriptExportOptions/ManuscriptExportOptions';
import {
  MANUSCRIPT_EXPORT_FORMATS,
  SCREENPLAY_EXPORT_FORMATS,
} from '../../../components/features/manuscript/export/manuscriptExport';
import {
  applyPreset,
  defaultExportSettings,
} from '../../../components/features/manuscript/export/manuscriptExportSettings';
import { useBackButtonHandler } from '../../../hooks/useBackButtonHandler';
import { useScreenHeader } from '../../../hooks/useScreenHeader';
import { useStoryStore } from '../../../state/storyStore';
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
  const {
    loading,
    exporting,
    isBranching,
    looseCount,
    arcs,
    storyAuthor,
    exportWith,
    screenplayEstimate,
    estimatePages,
    sizeEstimate,
    hasMusic,
    hasSongs,
  } = useManuscriptExport();
  const effectiveArc = useStoryStore((state) => state.effectiveArc);
  // A campaign starts from its chronicle: the record of what the table played, ready to read.
  const [settings, setSettings] = useState(() =>
    effectiveArc?.medium === 'campaign'
      ? applyPreset(defaultExportSettings(storyAuthor), 'chronicle')
      : defaultExportSettings(storyAuthor),
  );
  // The page count asked for, tied to the settings it was counted with: change one and it is gone.
  const [counted, setCounted] = useState<{
    settings: typeof settings;
    result: ReturnType<typeof estimatePages>;
  } | null>(null);
  const pageEstimate = counted && counted.settings === settings ? counted.result : null;
  useScreenHeader({ target: 'parent', title: t('export_manuscript_title') });

  // A screenplay's own formats are offered where the work is one: the selected work (or the one the
  // export is of), never for a branching story, whose order is a graph and not a script.
  const exportedArc = settings.arcId ? arcs.find((arc) => arc.id === settings.arcId) : undefined;
  const medium = exportedArc?.medium ?? effectiveArc?.medium ?? 'generic';
  const formats =
    !isBranching && medium === 'screenplay'
      ? [...MANUSCRIPT_EXPORT_FORMATS, ...SCREENPLAY_EXPORT_FORMATS]
      : MANUSCRIPT_EXPORT_FORMATS;

  if (loading) return <ScreenLoading message={t('loading')} padded />;

  const handleExport = async () => {
    if (await exportWith(settings)) navigation.goBack();
  };

  return (
    <EntityFormContainer
      planUsage={false}
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
        formats={formats}
        screenplayEstimate={screenplayEstimate(settings)}
        onEstimatePages={
          isBranching || medium === 'comic' || medium === 'storyboard'
            ? undefined
            : () => setCounted({ settings, result: estimatePages(settings) })
        }
        pageEstimate={pageEstimate}
        sizeEstimate={sizeEstimate(settings)}
        hasMusic={hasMusic}
        hasSongs={hasSongs}
        branching={isBranching}
        showLooseSwitch={!isBranching && looseCount > 0}
        looseCount={looseCount}
        chapterNumberingAvailable={!isBranching}
        arcs={arcs}
        chronicle={medium === 'campaign'}
      />
    </EntityFormContainer>
  );
};

export default ManuscriptExportScreen;
