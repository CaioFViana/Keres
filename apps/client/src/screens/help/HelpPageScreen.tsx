import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text } from 'react-native';
import { HelpBlockRenderer } from '../../components/features/help/HelpBlockRenderer/HelpBlockRenderer';
import { DocLibrary, helpLibrary } from '../../help/library';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useTheme } from '../../theme';
import { setDocumentTitle } from '../../utils/documentTitle';

type HelpNavigation = NativeStackNavigationProp<Record<string, object | undefined>>;

type HelpPageScreenProps = {
  /** Qual biblioteca renderizar. O padrão mantém esta tela como a página da Ajuda. */
  library?: DocLibrary;
};

export function HelpPageScreen({ library = helpLibrary }: HelpPageScreenProps) {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<HelpNavigation>();
  const route = useRoute<{
    key: string;
    name: string;
    params: { pageId: string; returnDrawerRoute?: string };
  }>();
  const { colors } = useTheme();
  const { page, usedFallback } = library.resolvePage(route.params.pageId, i18n.language);
  const returnToOrigin = useCallback(() => {
    // Drawer history is not guaranteed after a nested navigate. The contextual
    // shortcut therefore records the exact drawer route to restore.
    const drawerNavigation = navigation.getParent();
    if (drawerNavigation && route.params.returnDrawerRoute) {
      drawerNavigation.navigate(route.params.returnDrawerRoute as never);
    }
    else navigation.goBack();
  }, [navigation, route.params.returnDrawerRoute]);
  useBackButtonHandler({
    showWebBackButton: true,
    onBack: route.params.returnDrawerRoute ? returnToOrigin : undefined,
  });

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(page?.title ?? t(library.notFoundKey));
    }, [page?.title, t, library.notFoundKey]),
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
              {t(library.fallbackNoticeKey)}
            </Text>
          ) : null}
          {page.blocks.map((block, index) => (
            <HelpBlockRenderer
              key={index}
              block={block}
              onOpenPage={(pageId) => navigation.push(library.pageRouteName, { pageId })}
              pageTitle={(pageId) => library.getPage(pageId, i18n.language)?.title ?? pageId}
            />
          ))}
        </>
      ) : (
        <Text style={{ color: colors.text, fontSize: 16 }}>{t(library.notFoundKey)}</Text>
      )}
    </ScrollView>
  );
}
