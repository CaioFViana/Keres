import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import type { StorySelect } from '@/src/db/schema';
import { useTranslation } from 'react-i18next';
import { useStoryVocabulary } from '../../vocabulary/useStoryVocabulary';
import { StyleSheet, Text, View } from 'react-native';
import ManuscriptExportOptions from '../../components/features/manuscript/ManuscriptExportOptions/ManuscriptExportOptions';
import { SERVER_MANUSCRIPT_FORMATS } from '../../services/PublicationApiService';
import { useTheme } from '../../theme';
import type { PublishManuscriptState } from './usePublishManuscript';

/**
 * The manuscript block of an expanded story: the two switches (a manuscript file, and the story
 * read online on the showcase) and then every option the device export offers - the same
 * component, over the server's formats, shared by both because both are made from the same choices.
 */
export function PublishManuscriptSection({
  story,
  manuscript,
}: {
  story: StorySelect;
  manuscript: PublishManuscriptState;
}) {
  const storyId = story.id;
  const storyType = story.type;
  const { term } = useStoryVocabulary();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    label: { fontSize: 13, fontWeight: 'bold', color: colors.text, marginBottom: 8 },
    selectOne: { fontSize: 13, fontWeight: 'bold', color: colors.textSecondary, marginBottom: 10 },
    selectOneMissing: { color: colors.error },
    hint: { fontSize: 12, color: colors.textSecondary, marginTop: -4, marginBottom: 12 },
    options: { marginBottom: 16 },
    release: { marginBottom: 14 },
  });

  const branching = storyType === 'branching';
  const works = manuscript.manuscriptArcs;
  const releasingWork = manuscript.releaseArcId !== null;
  return (
    <>
      {works.length > 1 && (
        <View style={styles.release} testID={`publish-release-${storyId}`}>
          <Text style={styles.label}>{t('publish_release_what')}</Text>
          <SingleSelectPill
            value={manuscript.releaseArcId ?? 'universe'}
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
            testID={`publish-package-switch-${storyId}`}
          />
        </View>
      )}
      <View style={styles.switchRow}>
        <Text style={styles.label}>{t('publish_manuscript_attach')}</Text>
        <ThemedSwitch
          value={manuscript.attachManuscript}
          onValueChange={manuscript.setAttachManuscript}
          testID={`publish-manuscript-switch-${storyId}`}
        />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.label}>{t('publish_reader_attach')}</Text>
        <ThemedSwitch
          value={manuscript.publishReader}
          onValueChange={manuscript.setPublishReader}
          testID={`publish-reader-switch-${storyId}`}
        />
      </View>
      <Text style={styles.hint}>{t('publish_reader_hint')}</Text>
      {(manuscript.attachManuscript || manuscript.publishReader) && (
        <View style={styles.options} testID={`publish-manuscript-options-${storyId}`}>
          <ManuscriptExportOptions
            settings={manuscript.settings}
            onChange={manuscript.setSettings}
            formats={SERVER_MANUSCRIPT_FORMATS}
            branching={branching}
            showLooseSwitch={!branching && manuscript.manuscriptLooseCount > 0}
            looseCount={manuscript.manuscriptLooseCount}
            chapterNumberingAvailable={!branching}
            // A work is chosen above; the picker inside the options is for the whole universe only.
            arcs={releasingWork ? [] : manuscript.manuscriptArcs}
            showFormat={manuscript.attachManuscript}
          />
        </View>
      )}
    </>
  );
}
