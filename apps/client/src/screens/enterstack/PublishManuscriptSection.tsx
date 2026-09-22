import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SingleSelectPill } from '../../components/common/inputs/MultiSelectPill/MultiSelectPill';
import { SERVER_MANUSCRIPT_FORMATS } from '../../services/PublicationApiService';
import { useTheme } from '../../theme';
import type { PublishManuscriptState } from './usePublishManuscript';

/** The manuscript block of an expanded story: attach switch, format, scope. */
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
    modeRow: { flexDirection: 'row', marginBottom: 16 },
    modeOption: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
      marginRight: 8,
    },
    modeOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    modeText: { fontSize: 13, color: colors.text },
    modeTextActive: { color: colors.onPrimary, fontWeight: 'bold' },
  });

  const noRoutes = storyType === 'branching' && manuscript.manuscriptRoutes.length === 0;
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
        <>
          <Text style={styles.label}>{t('publish_manuscript_format')}</Text>
          <View style={styles.modeRow}>
            {SERVER_MANUSCRIPT_FORMATS.map((format) => (
              <TouchableOpacity
                key={format}
                style={[
                  styles.modeOption,
                  manuscript.manuscriptFormat === format && styles.modeOptionActive,
                ]}
                onPress={() => manuscript.setManuscriptFormat(format)}
              >
                <Text
                  style={[
                    styles.modeText,
                    manuscript.manuscriptFormat === format && styles.modeTextActive,
                  ]}
                >
                  {t(`export_manuscript_format_${format}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {storyType === 'linear' ? (
            <View style={styles.switchRow}>
              <Text style={styles.label}>
                {t('publish_manuscript_include_loose', { count: manuscript.manuscriptLooseCount })}
              </Text>
              <ThemedSwitch
                value={manuscript.includeLooseScenes}
                onValueChange={manuscript.setIncludeLooseScenes}
                testID={`publish-loose-switch-${storyId}`}
              />
            </View>
          ) : (
            manuscript.manuscriptRoutes.length > 0 && (
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
            )
          )}
        </>
      )}
    </>
  );
}
