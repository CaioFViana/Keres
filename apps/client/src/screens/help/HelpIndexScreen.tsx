import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { HelpSearchBar } from '../../components/features/help/HelpSearchBar/HelpSearchBar';
import { HighlightedText } from '../../components/features/help/HelpSearchBar/HighlightedText';
import { helpSections } from '../../help/catalog';
import { getHelpPage, getHelpPages } from '../../help/repository';
import { createHelpSearchIndex, searchHelp } from '../../help/search';
import { useTheme } from '../../theme';
import { debounce } from '../../utils/debounce';
import { setDocumentTitle } from '../../utils/documentTitle';

type HelpNavigation = NativeStackNavigationProp<{
  HelpIndex: undefined;
  HelpPage: { pageId: string };
}>;

type HelpIndexScreenProps = {
  openSections?: Record<string, boolean>;
  onOpenSectionsChange?: Dispatch<SetStateAction<Record<string, boolean>>>;
};

export function HelpIndexScreen({ openSections, onOpenSectionsChange }: HelpIndexScreenProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<HelpNavigation>();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [defaultOpenSections, setDefaultOpenSections] = useState<Record<string, boolean>>({ start: true });
  const open = openSections ?? defaultOpenSections;
  const setOpen = onOpenSectionsChange ?? setDefaultOpenSections;
  const pages = useMemo(() => getHelpPages(i18n.language), [i18n.language]);
  const searchIndex = useMemo(() => createHelpSearchIndex(pages), [pages]);
  const results = useMemo(
    () => searchHelp(searchIndex, debouncedQuery),
    [searchIndex, debouncedQuery],
  );
  const commitSearch = useMemo(
    () => debounce((value: string) => setDebouncedQuery(value), 400),
    [],
  );

  useEffect(() => {
    commitSearch(query);
    return () => commitSearch.cancel?.();
  }, [commitSearch, query]);

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(t('help_index_title'));
    }, [t]),
  );

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    section: {
      marginHorizontal: 16,
      marginTop: 12,
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 8,
      overflow: 'hidden',
    },
    sectionHeader: {
      padding: 14,
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
    },
    sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: 17, fontWeight: '700', color: colors.text },
    card: { padding: 14, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
    summary: { color: colors.textSecondary, marginTop: 4, lineHeight: 19 },
    label: { color: colors.textSecondary, fontSize: 12, marginBottom: 3 },
    empty: { padding: 24, color: colors.textSecondary, textAlign: 'center' },
  });
  const openPage = (id: string) => navigation.navigate('HelpPage', { pageId: id });

  return (
    <View style={styles.container}>
      <HelpSearchBar
        value={query}
        onChangeText={setQuery}
        onClear={() => setQuery('')}
        placeholder={t('help_search_placeholder')}
        clearAccessibilityLabel={t('help_search_clear')}
        color={colors.textSecondary}
        borderColor={colors.border}
      />
      {debouncedQuery ? (
        <ScrollView>
          {results.length ? (
            <>
              <Text style={styles.label}>
                {t('help_search_results_count', { count: results.length })}
              </Text>
              {results.map(({ page, excerpt }) => (
                <TouchableOpacity
                  key={page.id}
                  style={styles.card}
                  onPress={() => openPage(page.id)}
                >
                  <Text style={styles.label}>
                    {t(
                      helpSections.find((section) => section.pageIds.includes(page.id))?.titleKey ??
                        'help_title',
                    )}
                  </Text>
                  <Text style={styles.title}>{page.title}</Text>
                  <HighlightedText
                    text={excerpt}
                    query={debouncedQuery}
                    style={styles.summary}
                    highlightColor={colors.primaryContainer}
                  />
                </TouchableOpacity>
              ))}
            </>
          ) : (
            <>
              <Text style={styles.empty}>{t('help_no_results')}</Text>
              <TouchableOpacity onPress={() => openPage('using-this-help')}>
                <Text style={styles.empty}>{t('help_no_results_hint')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openPage('faq')}>
                <Text style={styles.empty}>{t('help_no_results_faq_link')}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      ) : (
        <ScrollView>
          {helpSections.map((section) => {
            const isOpen = !!open[section.id];
            return (
              <View key={section.id} style={styles.section}>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => setOpen((old) => ({ ...old, [section.id]: !old[section.id] }))}
                >
                  <View style={styles.sectionTitle}>
                    <Ionicons
                      name={section.icon as keyof typeof Ionicons.glyphMap}
                      size={20}
                      color={colors.text}
                    />
                    <Text style={styles.title}>{t(section.titleKey)}</Text>
                  </View>
                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.text}
                  />
                </TouchableOpacity>
                {isOpen &&
                  section.pageIds.map((id) => {
                    const page = getHelpPage(id, i18n.language);
                    return (
                      page && (
                        <TouchableOpacity key={id} style={styles.card} onPress={() => openPage(id)}>
                          <Text style={styles.title}>{page.title}</Text>
                          <Text style={styles.summary}>{page.summary}</Text>
                        </TouchableOpacity>
                      )
                    );
                  })}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
