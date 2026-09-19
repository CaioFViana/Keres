import { LanguageInstallRow } from '@/src/components/common';
import { useLanguageLabel } from '@/src/hooks/useLanguageLabel';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '../../db';
import {
  createShippedPackService,
  type ShippedPackPreview,
} from '../../services/storymanagement/ShippedPackService';
import { useNotificationStore } from '../../state/notificationStore';
import { useShippedPacksInstallerStore } from '../../state/shippedPacksInstallerStore';
import { useTheme } from '../../theme';
import { commonDetailStyleDefs, commonScreenStyleDefs } from '../../theme/commonStyles';
import { packExtrasChips } from '../../utils/packChips';

interface ShippedPacksContentProps {
  /**
   * Called when asked to close (the overlay's close button).
   *
   * The component does not know whether it sits inside real navigation (`PacksStack.ShippedPacks`)
   * or a simple overlay (the installer opened from the story form); that is why it does not call
   * `navigation.goBack()` directly - its host decides what "close" means.
   */
  onClose?: () => void;
  /** Shows an explicit control to close the overlay hosting the content. */
  showCloseButton?: boolean;
}

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
 *
 * Deliberately with nothing about navigation (no `useRoute`/`useNavigation`) so it can be hosted
 * two ways, following `GalleryDetailContent`: as an ordinary screen of the packs stack
 * (`ShippedPacksScreen`, real navigation, the back button leaving its own stack), or inside a
 * `Modal` opened by `ShippedPacksInstallerOverlay` when the story form offers starter packs
 * without leaving. That second form exists because navigating away would abandon the half-filled
 * form, while a `Modal` does not take part in React Navigation's focus and leaves it untouched.
 */
const ShippedPacksContent: React.FC<ShippedPacksContentProps> = ({
  onClose,
  showCloseButton = false,
}) => {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const drizzleDb = useDrizzle();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const markInstalled = useShippedPacksInstallerStore((state) => state.markInstalled);

  const [groups, setGroups] = useState<ShippedPackGroup[]>([]);
  const [installingSlug, setInstallingSlug] = useState<string | null>(null);
  const [chosenLanguageBySlug, setChosenLanguageBySlug] = useState<Record<string, string>>({});

  useEffect(() => {
    // Loaded on mount rather than on focus: the previews are static bundled data, so refetching
    // on every focus bought nothing even when this was a screen alone - and the overlay host has
    // no focus events at all.
    setGroups(groupBySlug(createShippedPackService(drizzleDb).previewShippedPacks()));
  }, [drizzleDb]);

  const languageLabel = useLanguageLabel();

  const handleInstall = useCallback(
    async (slug: string, language: string) => {
      setInstallingSlug(slug);
      try {
        const result = await createShippedPackService(drizzleDb).installShippedPack(slug, language);
        if (result.status === 'installed') {
          markInstalled(result.packId);
          showNotification(t('shipped_packs_install_success'), 'success');
        } else {
          showNotification(t('shipped_packs_install_failed'), 'error');
        }
      } catch (error) {
        console.error(`ShippedPacksContent: failed to install ${slug}/${language}.`, error);
        showNotification(t('shipped_packs_install_failed'), 'error');
      } finally {
        setInstallingSlug(null);
      }
    },
    [drizzleDb, markInstalled, showNotification, t],
  );

  const styles = StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    ...commonDetailStyleDefs(colors),
    content: { padding: 20, paddingBottom: 60 },
    description: { fontSize: 14, color: colors.textSecondary, marginBottom: 18, lineHeight: 20 },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 4,
    },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text, flexShrink: 1 },
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
        shown.counts.hasVocabulary && t('packs_chip_vocabulary'),
        shown.statSystem && t('shipped_packs_chip_stat_system'),
        ...packExtrasChips(shown.counts, t),
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

          <LanguageInstallRow
            options={item.languages.map((language) => ({
              label: languageLabel(language.language),
              value: language.language,
            }))}
            value={selectedLanguage}
            onValueChange={(value) =>
              setChosenLanguageBySlug((previous) => ({ ...previous, [item.slug]: value }))
            }
            onInstall={() => handleInstall(item.slug, selectedLanguage)}
            installing={isInstalling}
            accessibilityLabel={t('shipped_packs_install')}
            testID={`install-${item.slug}`}
          />
        </View>
      );
    },
    [
      chosenLanguageBySlug,
      colors.primary,
      handleInstall,
      i18n.language,
      installingSlug,
      languageLabel,
      styles.card,
      styles.cardDescription,
      styles.cardTitle,
      styles.cardTitleRow,
      styles.chip,
      styles.chipText,
      styles.contents,
      t,
    ],
  );

  return (
    <View style={styles.container}>
      {showCloseButton && onClose && (
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t('shipped_packs_title')}</Text>
          <TouchableOpacity
            accessibilityLabel={t('close')}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      )}
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

export default ShippedPacksContent;
