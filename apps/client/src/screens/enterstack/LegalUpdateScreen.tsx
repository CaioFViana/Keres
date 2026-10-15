import Button from '@/src/components/common/controls/Button/Button';
import TermsModal from '@/src/components/features/servers/TermsModal/TermsModal';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { type ClientLegalBehind, legalIsBehind } from '@/src/legal/clientLegalStatus';
import {
  CLIENT_TERMS_UPDATED_AT,
  CLIENT_TERMS_VERSION,
  clientTermsFor,
} from '@/src/legal/clientTerms';
import {
  type ClientLegalDocument,
  getAcceptedClientLegal,
  setAcceptedClientLegal,
} from '@/src/legal/clientTermsAcceptance';
import {
  CLIENT_PRIVACY_UPDATED_AT,
  CLIENT_PRIVACY_VERSION,
  clientPrivacyFor,
} from '@/src/legal/privacyPolicy';
import { type ThemeColors, useTheme } from '@/src/theme';
import { space, typography } from '@/src/theme/tokens';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import { useDocumentTitle } from '@/src/utils/documentTitle';

type RootStackParamList = {
  LegalUpdate: undefined;
  StorySelection: undefined;
};

type LegalUpdateScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'LegalUpdate'>;

const DOCUMENTS: readonly ClientLegalDocument[] = ['terms', 'privacy'];

/** The version each document is agreed to at now: what an acceptance here records. */
const CURRENT_VERSION: Record<ClientLegalDocument, number> = {
  terms: CLIENT_TERMS_VERSION,
  privacy: CLIENT_PRIVACY_VERSION,
};

/**
 * Shown before the story list when the Terms or the Privacy Policy changed after this device last agreed to them (or
 * never recorded an agreement). Only the documents that are behind are listed; each one opens the text with the same
 * reading gate as the welcome, and Continue waits until every listed document has been agreed to.
 */
const LegalUpdateScreen = () => {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t('legal_update_title'));
  const navigation = useNavigation<LegalUpdateScreenNavigationProp>();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Null while the records are read: nothing can be agreed to or continued past until the list is known.
  const [behind, setBehind] = useState<ClientLegalBehind | null>(null);
  const [agreed, setAgreed] = useState<ClientLegalBehind>({ terms: false, privacy: false });
  const [openDocument, setOpenDocument] = useState<ClientLegalDocument | null>(null);

  useEffect(() => {
    let cancelled = false;
    const readBehind = async (): Promise<ClientLegalBehind> => {
      try {
        const [terms, privacy] = await Promise.all([
          getAcceptedClientLegal('terms'),
          getAcceptedClientLegal('privacy'),
        ]);
        return legalIsBehind(terms?.version ?? null, privacy?.version ?? null);
      } catch {
        // A record that cannot be read is asked again rather than assumed agreed.
        return legalIsBehind(null, null);
      }
    };
    void readBehind().then((result) => {
      if (!cancelled) setBehind(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const canContinue =
    behind !== null && DOCUMENTS.every((document) => !behind[document] || agreed[document]);

  const acceptDocument = (document: ClientLegalDocument) => {
    setAgreed((current) => ({ ...current, [document]: true }));
    setOpenDocument(null);
    void setAcceptedClientLegal(document, CURRENT_VERSION[document], 'reaccept');
  };

  const onContinue = () => {
    navigation.reset({ index: 0, routes: [{ name: 'StorySelection' }] });
  };

  const listed = DOCUMENTS.filter((document) => behind?.[document] === true);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="legal-update-screen"
    >
      <View style={styles.column}>
        <Text style={[typography.title, { color: colors.text }]}>{t('legal_update_title')}</Text>
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          {t('legal_update_intro')}
        </Text>

        {listed.map((document) => (
          <View key={document} style={styles.row} testID={`legal-update-row-${document}`}>
            <Text style={[typography.sectionTitle, { color: colors.text }]}>
              {document === 'terms' ? t('client_terms_title') : t('client_privacy_title')}
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              {document === 'terms'
                ? t('legal_update_terms_changed')
                : t('legal_update_privacy_changed')}
            </Text>
            {agreed[document] ? (
              <Text style={[typography.label, { color: colors.primary }]}>
                {t('legal_update_agreed')}
              </Text>
            ) : (
              <Button
                onPress={() => setOpenDocument(document)}
                testID={`legal-update-${document}-read`}
              >
                {t('legal_update_read')}
              </Button>
            )}
          </View>
        ))}

        <Button onPress={onContinue} disabled={!canContinue} testID="legal-update-continue">
          {t('legal_update_continue')}
        </Button>
      </View>

      {behind?.terms ? (
        <TermsModal
          visible={openDocument === 'terms'}
          title={t('client_terms_title')}
          subtitle={t('client_terms_version', {
            version: CLIENT_TERMS_VERSION,
            date: CLIENT_TERMS_UPDATED_AT,
          })}
          sections={clientTermsFor(i18n.language)}
          mode="accept"
          acceptLabel={t('terms_accept')}
          onAccept={() => acceptDocument('terms')}
          onClose={() => setOpenDocument(null)}
          requireScrollToEnd
          testID="legal-update-terms-modal"
        />
      ) : null}
      {behind?.privacy ? (
        <TermsModal
          visible={openDocument === 'privacy'}
          title={t('client_privacy_title')}
          subtitle={t('client_privacy_version', {
            version: CLIENT_PRIVACY_VERSION,
            date: CLIENT_PRIVACY_UPDATED_AT,
          })}
          sections={clientPrivacyFor(i18n.language)}
          mode="accept"
          acceptLabel={t('terms_accept')}
          onAccept={() => acceptDocument('privacy')}
          onClose={() => setOpenDocument(null)}
          requireScrollToEnd
          testID="legal-update-privacy-modal"
        />
      ) : null}
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { flexGrow: 1, alignItems: 'center', padding: space.xl },
    column: { width: '100%', maxWidth: 560, gap: space.lg },
    row: {
      gap: space.sm,
      paddingVertical: space.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
  });

export default LegalUpdateScreen;
