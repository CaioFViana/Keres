import Select from '@/src/components/common/inputs/Select/Select';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import {
  createShippedPackService,
  type ShippedPackPreview,
} from '../../services/storymanagement/ShippedPackService';
import { useNotificationStore } from '../../state/notificationStore';
import { useTheme } from '../../theme';
import { commonDetailStyleDefs, commonScreenStyleDefs } from '../../theme/commonStyles';
import { useDocumentTitle } from '../../utils/documentTitle';
import { getLanguageOptions } from '../../utils/i18n';

/**
 * The catalogue of packs Keres ships with.
 *
 * Nothing here is installed on its own. A pack decides how a story is shaped - which fields a
 * character has, whether stats exist at all - and Keres has no business holding that opinion for
 * the writer, so the catalogue offers and waits. Installing one makes it an ordinary pack on this
 * device, editable in no way and deletable in the usual one, exactly like a downloaded pack.
 *
 * Each language is a separate pack rather than a translation, so the dropdown chooses *which pack*
 * is installed, not how this screen is read. Installing both leaves two, and they conflict if
 * applied to the same story - which the creation screen reports, because they define the same keys.
 */

/** Groups the flat previews back into one row per pack, the way the catalogue reads. */
interface ShippedPackGroup {
  slug: string;
  languages: ShippedPackPreview[];
}

function groupBySlug(previews: ShippedPackPreview[]): ShippedPackGroup[] {
  const groups = new Map<string, ShippedPackPreview[]>();
  for (const preview of previews) {
    const existing = groups.get(preview.slug);
    if (existing) existing.push(preview);
    else groups.set(preview.slug, [preview]);
  }
  return [...groups].map(([slug, languages]) => ({ slug, languages }));
}

const ShippedPacksScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const drizzleDb = useDrizzle();
  const showNotification = useNotificationStore((state) => state.showNotification);
  useDocumentTitle(t('shipped_packs_title'));

  const [groups, setGroups] = useState<ShippedPackGroup[]>([]);
  const [installingSlug, setInstallingSlug] = useState<string | null>(null);
  const [chosenLanguageBySlug, setChosenLanguageBySlug] = useState<Record<string, string>>({});

  useFocusEffect(
    useCallback(() => {
      setGroups(groupBySlug(createShippedPackService(drizzleDb).previewShippedPacks()));
    }, [drizzleDb]),
  );

  const languageLabel = useLanguageLabel();

  const handleInstall = useCallback(
    async (slug: string, language: string) => {
      setInstallingSlug(slug);
      try {
        const result = await createShippedPackService(drizzleDb).installShippedPack(slug, language);
        if (result.status === 'installed') {
          showNotification(t('shipped_packs_install_success'), 'success');
        } else {
          showNotification(t('shipped_packs_install_failed'), 'error');
        }
      } catch (error) {
        console.error(`ShippedPacksScreen: failed to install ${slug}/${language}.`, error);
        showNotification(t('shipped_packs_install_failed'), 'error');
      } finally {
        setInstallingSlug(null);
      }
    },
    [drizzleDb, showNotification, t],
  );

  const styles = StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    ...commonDetailStyleDefs(colors),
    content: { padding: 20, paddingBottom: 60 },
    description: { fontSize: 14, color: colors.textSecondary, marginBottom: 18, lineHeight: 20 },
    card: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginBottom: 10,
      backgroundColor: colors.surface,
    },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center' },
    cardTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      marginLeft: 8,
      flexShrink: 1,
    },
    cardDescription: { fontSize: 13, color: colors.textSecondary, marginTop: 6 },
    contents: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6 },
    chip: {
      borderRadius: 12,
      paddingVertical: 3,
      paddingHorizontal: 9,
      backgroundColor: colors.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    chipText: { fontSize: 12, color: colors.textSecondary },
    installRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
    languageSelect: { flex: 1, marginRight: 10 },
    installButton: {
      width: 42,
      height: 42,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    installButtonDisabled: { opacity: 0.5 },
  });

  const renderItem = useCallback(
    ({ item }: { item: ShippedPackGroup }) => {
      const preferred =
        item.languages.find((language) => language.language === i18n.language) ?? item.languages[0];
      if (!preferred) return null;

      const selectedLanguage = chosenLanguageBySlug[item.slug] ?? preferred.language;
      // The preview follows the dropdown: choosing Portuguese must show the Portuguese pack, since
      // it is a different pack and not a translation of the one above it.
      const shown =
        item.languages.find((language) => language.language === selectedLanguage) ?? preferred;
      const isInstalling = installingSlug === item.slug;

      const chips = [
        shown.counts.customAttributes > 0 &&
          t('packs_chip_attributes', { count: shown.counts.customAttributes }),
        shown.counts.suggestions > 0 &&
          t('packs_chip_suggestions', { count: shown.counts.suggestions }),
        shown.counts.tags > 0 && t('packs_chip_tags', { count: shown.counts.tags }),
        shown.counts.stats > 0 && t('packs_chip_stats', { count: shown.counts.stats }),
        shown.statSystem && t('shipped_packs_chip_stat_system'),
      ].filter((chip): chip is string => Boolean(chip));

      return (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="cube-outline" size={18} color={colors.primary} />
            <Text style={styles.cardTitle} numberOfLines={1}>
              {shown.name}
            </Text>
          </View>
          {!!shown.description && <Text style={styles.cardDescription}>{shown.description}</Text>}

          <View style={styles.contents}>
            {chips.map((chip) => (
              <View key={chip} style={styles.chip}>
                <Text style={styles.chipText}>{chip}</Text>
              </View>
            ))}
          </View>

          <View style={styles.installRow}>
            <View style={styles.languageSelect}>
              <Select
                options={item.languages.map((language) => ({
                  label: languageLabel(language.language),
                  value: language.language,
                }))}
                value={selectedLanguage}
                onValueChange={(value) => {
                  if (!value) return;
                  setChosenLanguageBySlug((previous) => ({ ...previous, [item.slug]: value }));
                }}
                disabled={isInstalling}
              />
            </View>
            <TouchableOpacity
              style={[styles.installButton, isInstalling && styles.installButtonDisabled]}
              onPress={() => handleInstall(item.slug, selectedLanguage)}
              disabled={isInstalling}
              accessibilityLabel={t('shipped_packs_install')}
              testID={`install-${item.slug}`}
            >
              {isInstalling ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Ionicons name="download-outline" size={20} color={colors.onPrimary} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [
      chosenLanguageBySlug,
      colors,
      handleInstall,
      i18n.language,
      installingSlug,
      languageLabel,
      styles,
      t,
    ],
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={groups}
        keyExtractor={(group) => group.slug}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <Text style={styles.description}>{t('shipped_packs_description')}</Text>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>{t('shipped_packs_empty')}</Text>}
      />
    </View>
  );
};

/** Only the language's label, with no need for a key per pack language. */
function useLanguageLabel() {
  const { t } = useTranslation();
  const labelByCode = useMemo(
    () => new Map(getLanguageOptions(t).map((option) => [option.value, option.label])),
    [t],
  );
  return useCallback((code: string) => labelByCode.get(code) ?? code, [labelByCode]);
}

export default ShippedPacksScreen;
