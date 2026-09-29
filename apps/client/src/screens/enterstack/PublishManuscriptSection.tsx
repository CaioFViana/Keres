import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import { useTranslation } from 'react-i18next';
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
  storyId,
  storyType,
  manuscript,
}: {
  storyId: string;
  storyType: 'linear' | 'branching';
  manuscript: PublishManuscriptState;
}) {
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
    hint: { fontSize: 12, color: colors.textSecondary, marginTop: -4, marginBottom: 12 },
    options: { marginBottom: 16 },
  });

  const branching = storyType === 'branching';
  return (
    <>
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
            arcs={manuscript.manuscriptArcs}
            showFormat={manuscript.attachManuscript}
          />
        </View>
      )}
    </>
  );
}
