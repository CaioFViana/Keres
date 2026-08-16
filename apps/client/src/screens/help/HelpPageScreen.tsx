import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text } from 'react-native';
import { HelpBlockRenderer } from '../../components/features/help/HelpBlockRenderer/HelpBlockRenderer';
import { getHelpPage, resolveHelpPage } from '../../help/repository';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useTheme } from '../../theme';
import { setDocumentTitle } from '../../utils/documentTitle';

type HelpNavigation = NativeStackNavigationProp<{
  HelpIndex: undefined;
  HelpPage: { pageId: string };
}>;

export function HelpPageScreen() {
  useBackButtonHandler({ showWebBackButton: true });
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<HelpNavigation>();
  const route = useRoute<{ key: string; name: 'HelpPage'; params: { pageId: string } }>();
  const { colors } = useTheme();
  const { page, usedFallback } = resolveHelpPage(route.params.pageId, i18n.language);

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(page?.title ?? t('help_page_not_found'));
    }, [page?.title, t]),
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
    >
      {page ? (
        <>
          <Text style={{ fontSize: 26, fontWeight: '700', color: colors.text, marginBottom: 16 }}>
            {page.title}
          </Text>
          {usedFallback ? (
            <Text style={{ color: colors.textSecondary, marginBottom: 16 }}>
              {t('help_language_fallback_notice')}
            </Text>
          ) : null}
          {page.blocks.map((block, index) => (
            <HelpBlockRenderer
              key={index}
              block={block}
              onOpenPage={(pageId) => navigation.push('HelpPage', { pageId })}
              pageTitle={(pageId) => getHelpPage(pageId, i18n.language)?.title ?? pageId}
            />
          ))}
        </>
      ) : (
        <Text style={{ color: colors.text, fontSize: 16 }}>{t('help_page_not_found')}</Text>
      )}
    </ScrollView>
  );
}
