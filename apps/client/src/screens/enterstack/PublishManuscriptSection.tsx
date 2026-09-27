import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { SingleSelectPill } from '../../components/common/inputs/MultiSelectPill/MultiSelectPill';
import ManuscriptExportOptions from '../../components/features/manuscript/ManuscriptExportOptions/ManuscriptExportOptions';
import { SERVER_MANUSCRIPT_FORMATS } from '../../services/PublicationApiService';
import { useTheme } from '../../theme';
import type { PublishManuscriptState } from './usePublishManuscript';

/**
 * The manuscript block of an expanded story: the attach switch, the route of a branching story, and
 * then every option the device export offers - the same component, over the server's formats.
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
    hint: { fontSize: 12, color: colors.textSecondary, marginTop: -8, marginBottom: 16 },
    options: { marginBottom: 16 },
  });

  const branching = storyType === 'branching';
  const noRoutes = branching && manuscript.manuscriptRoutes.length === 0;
  return (
    <>
      <View style={styles.switchRow}>
        <Text style={styles.label}>{t('publish_manuscript_attach')}</Text>
        <ThemedSwitch
          value={manuscript.attachManuscript}
          onValueChange={manuscript.setAttachManuscript}
          disabled={noRoutes}
          testID={`publish-manuscript-switch-${storyId}`}
        />
      </View>
      {noRoutes && <Text style={styles.hint}>{t('publish_manuscript_no_routes')}</Text>}
      {manuscript.attachManuscript && (
        <View style={styles.options} testID={`publish-manuscript-options-${storyId}`}>
          {branching && manuscript.manuscriptRoutes.length > 0 && (
            <>
              <Text style={styles.label}>{t('publish_manuscript_route')}</Text>
              <SingleSelectPill
                options={manuscript.manuscriptRoutes.map((entry) => ({
                  label: entry.name,
                  value: entry.id,
                }))}
                value={manuscript.manuscriptRouteId ?? manuscript.manuscriptRoutes[0]?.id ?? null}
                onValueChange={manuscript.setManuscriptRouteId}
                placeholder={t('publish_manuscript_route')}
              />
            </>
          )}
          <ManuscriptExportOptions
            settings={manuscript.settings}
            onChange={manuscript.setSettings}
            formats={SERVER_MANUSCRIPT_FORMATS}
            routeName={null}
            showLooseSwitch={!branching && manuscript.manuscriptLooseCount > 0}
            looseCount={manuscript.manuscriptLooseCount}
            chapterNumberingAvailable={!branching}
            arcs={manuscript.manuscriptArcs}
          />
        </View>
      )}
    </>
  );
}
