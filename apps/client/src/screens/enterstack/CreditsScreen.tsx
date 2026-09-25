import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import {
  APP_RELEASE,
  KERES_LICENSE,
  KERES_REPOSITORY_URL,
  THIRD_PARTY_CREDITS,
} from '@keres/shared';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';

// Colour only, no underline: the same link treatment as entity mentions elsewhere.
const CreditLink = ({ url, children }: { url: string; children: React.ReactNode }) => {
  const { colors } = useTheme();
  return (
    <Text
      style={{ color: colors.primary }}
      onPress={() => void Linking.openURL(url)}
      accessibilityRole="link"
    >
      {children}
    </Text>
  );
};

/**
 * The release and its licenses, reached by tapping the Keres emblem in Settings.
 *
 * The version and phrase are the release's voice - English, quoted verbatim from
 * `APP_RELEASE`, never translated. Everything around them is interface prose and translated.
 */
const CreditsScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  useScreenHeader({ target: 'parent', title: t('credits_title') });
  const { colors } = useTheme();
  const commonContainerStyles = getCommonContainerStyles(colors);

  return (
    <ScrollView style={commonContainerStyles.container} contentContainerStyle={styles.content}>
      <View>
        <Text style={[styles.version, { color: colors.text }]}>
          Keres {APP_RELEASE.version} {APP_RELEASE.name}
        </Text>
        <Text style={[styles.phrase, { color: colors.textSecondary }]}>
          {'\u201C'}
          {APP_RELEASE.phrase}
          {'\u201D'}
        </Text>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        {t('credits_licenses_title')}
      </Text>

      <View style={[styles.entry, { borderBottomColor: colors.border }]}>
        <Text style={[styles.entryProject, { color: colors.text }]}>Keres</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          {t('credits_keres_license')}
        </Text>
        <Text style={styles.body}>
          <CreditLink url={KERES_LICENSE.url}>
            {KERES_LICENSE.name} ({KERES_LICENSE.shortName})
          </CreditLink>
          {' · '}
          <CreditLink url={KERES_REPOSITORY_URL}>{t('credits_repository')}</CreditLink>
        </Text>
      </View>

      {THIRD_PARTY_CREDITS.map((credit) => (
        <View key={credit.project} style={[styles.entry, { borderBottomColor: colors.border }]}>
          <Text style={styles.entryProject}>
            <CreditLink url={credit.projectUrl}>{credit.project}</CreditLink>
          </Text>
          <Text style={styles.body}>
            <CreditLink url={credit.licenseUrl}>{credit.license}</CreditLink>
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            {t('credits_authors')}
            {': '}
            {credit.authors.flatMap((author, index) => [
              ...(index > 0 ? [', '] : []),
              <CreditLink key={author.name} url={author.url}>
                {author.name}
              </CreditLink>,
            ])}
          </Text>
          {credit.noteKey ? (
            <Text style={[styles.note, { color: colors.textSecondary }]}>{t(credit.noteKey)}</Text>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingBottom: 24,
  },
  version: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  phrase: {
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 22,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    marginTop: 28,
  },
  entry: {
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  entryProject: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  note: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
});

export default CreditsScreen;
