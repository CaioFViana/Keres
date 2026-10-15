import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import type { StorySelect } from '@/src/db/schema';
import { useTranslation } from 'react-i18next';
import { useStoryVocabulary } from '@/src/vocabulary/useStoryVocabulary';
import { StyleSheet, Text, View } from 'react-native';
import ManuscriptExportOptions from '@/src/components/features/manuscript/ManuscriptExportOptions/ManuscriptExportOptions';
import { SCREENPLAY_EXPORT_FORMATS } from '@/src/components/features/manuscript/export/manuscriptExport';
import { SERVER_MANUSCRIPT_FORMATS } from '@/src/services/PublicationApiService';
import type { ThemeColors } from '@/src/theme';
import { typography } from '@/src/theme/tokens';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import type { PublishManuscriptState } from './usePublishManuscript';

/**
 * The manuscript block of an expanded story: the two switches (a manuscript file, and the story
 * read online on the showcase) and then every option the device export offers - the same
 * component, over the server's formats, shared by both because both are made from the same choices.
 */
export function PublishManuscriptSection({
  story,
  manuscript,
  disabled = false,
}: {
  story: StorySelect;
  manuscript: PublishManuscriptState;
  /** While a publish compiles or uploads: the choices stand as sent. */
  disabled?: boolean;
}) {
  const storyId = story.id;
  const storyType = story.type;
  const { term } = useStoryVocabulary();
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);

  const branching = storyType === 'branching';
  const works = manuscript.manuscriptArcs;
  const releasingWork = manuscript.releaseArcId !== null;
  // A screenplay's own formats are offered for a work that is one (or a story whose only work is).
  const target = releasingWork
    ? works.find((work) => work.id === manuscript.releaseArcId)
    : works.length === 1
      ? works[0]
      : undefined;
  const formats =
    !branching && target?.medium === 'screenplay'
      ? [...SERVER_MANUSCRIPT_FORMATS, ...SCREENPLAY_EXPORT_FORMATS]
      : SERVER_MANUSCRIPT_FORMATS;
  return (
    <>
      {works.length > 1 && (
        <View style={styles.release} testID={`publish-release-${storyId}`}>
          <Text style={styles.label}>{t('publish_release_what')}</Text>
          <SingleSelectPill
            value={manuscript.releaseArcId ?? 'universe'}
            disabled={disabled}
            onValueChange={(value) =>
              manuscript.setReleaseArcId(value && value !== 'universe' ? value : null, story)
            }
            options={[
              { value: 'universe', label: t('publish_release_universe') },
              ...works.map((work) => ({
                value: work.id,
                label: `${term('Arc')}: ${work.title} (${t(`arc_medium_${work.medium}`)})`,
              })),
            ]}
            placeholder={t('publish_release_what')}
          />
          {releasingWork && <Text style={styles.hint}>{t('publish_release_work_hint')}</Text>}
        </View>
      )}
      <Text
        style={[styles.selectOne, manuscript.nothingSelected && styles.selectOneMissing]}
        testID={`publish-select-one-${storyId}`}
      >
        {t('publish_select_one')}
      </Text>
      {!releasingWork && (
        <View style={styles.switchRow}>
          <Text style={styles.label}>{t('publish_package_attach')}</Text>
          <ThemedSwitch
            value={manuscript.includePackage}
            onValueChange={manuscript.setIncludePackage}
            disabled={disabled}
            testID={`publish-package-switch-${storyId}`}
          />
        </View>
      )}
      <View style={styles.switchRow}>
        <Text style={styles.label}>{t('publish_manuscript_attach')}</Text>
        <ThemedSwitch
          value={manuscript.attachManuscript}
          onValueChange={manuscript.setAttachManuscript}
          disabled={disabled}
          testID={`publish-manuscript-switch-${storyId}`}
        />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.label}>{t('publish_reader_attach')}</Text>
        <ThemedSwitch
          value={manuscript.publishReader}
          onValueChange={manuscript.setPublishReader}
          disabled={disabled}
          testID={`publish-reader-switch-${storyId}`}
        />
      </View>
      <Text style={styles.hint}>{t('publish_reader_hint')}</Text>
      {releasingWork && manuscript.settings.includeLooseScenes && (
        <Text style={styles.hint} testID={`publish-release-loose-hint-${storyId}`}>
          {t('publish_release_loose_hint')}
        </Text>
      )}
      {(manuscript.attachManuscript || manuscript.publishReader) && (
        <View
          style={[styles.options, disabled && styles.optionsDisabled]}
          pointerEvents={disabled ? 'none' : 'auto'}
          testID={`publish-manuscript-options-${storyId}`}
        >
          <ManuscriptExportOptions
            settings={manuscript.settings}
            onChange={manuscript.setSettings}
            formats={formats}
            branching={branching}
            showLooseSwitch={!branching && manuscript.manuscriptLooseCount > 0}
            looseCount={manuscript.manuscriptLooseCount}
            chapterNumberingAvailable={!branching}
            // A work is chosen above; the picker inside the options is for the whole universe only.
            arcs={releasingWork ? [] : manuscript.manuscriptArcs}
            showFormat={manuscript.attachManuscript}
            hasSongs={manuscript.hasSungSongs}
            pagesMedium={manuscript.pagesMedium}
            hasCover={manuscript.hasCover}
          />
        </View>
      )}
    </>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    label: { fontSize: 13, fontWeight: 'bold', color: colors.text, marginBottom: 8 },
    selectOne: { fontSize: 13, fontWeight: 'bold', color: colors.textSecondary, marginBottom: 10 },
    selectOneMissing: { color: colors.error },
    hint: { ...typography.caption, color: colors.textSecondary, marginTop: -4, marginBottom: 12 },
    options: { marginBottom: 16 },
    optionsDisabled: { opacity: 0.5 },
    release: { marginBottom: 14 },
  });
