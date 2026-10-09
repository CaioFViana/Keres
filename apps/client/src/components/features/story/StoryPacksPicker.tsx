import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import { useTheme } from '../../../theme';

/** What the picker needs of a pack; `hasExtras` says it carries starter chapters, scenes or characters. */
export interface PickablePack {
  id: string;
  name: string;
  hasExtras: boolean;
}

interface StoryPacksPickerProps {
  packs: readonly PickablePack[];
  selectedPackIds: string[];
  onSelectionChange: (ids: string[]) => void;
  packsWithoutExtras: readonly string[];
  onToggleExtras: (packId: string, include: boolean) => void;
  /** Opens the catalogue of packs that come with the app, to install more of them. */
  onBrowse: () => void;
}

/** Choosing the packs a new story starts with, and which of them also bring their starter chapters and scenes. */
const StoryPacksPicker: React.FC<StoryPacksPickerProps> = ({
  packs,
  selectedPackIds,
  onSelectionChange,
  packsWithoutExtras,
  onToggleExtras,
  onBrowse,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const withExtras = packs.filter((pack) => selectedPackIds.includes(pack.id) && pack.hasExtras);

  return (
    <View style={styles.container} testID="story-packs-picker">
      <Text style={{ color: colors.textSecondary }}>{t('packs_apply_hint')}</Text>
      {packs.length > 0 ? (
        <MultiSelectPill
          options={packs.map((pack) => ({ label: pack.name, value: pack.id }))}
          selectedValues={selectedPackIds}
          onSelectionChange={onSelectionChange}
          placeholder={t('packs_apply_title')}
        />
      ) : (
        <Text style={{ color: colors.textSecondary }}>{t('packs_apply_none')}</Text>
      )}
      {withExtras.length > 0 && (
        <View>
          <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
            {t('packs_apply_extras_hint')}
          </Text>
          {withExtras.map((pack) => (
            <View key={pack.id} style={styles.extrasRow}>
              <View style={styles.extrasLabels}>
                <Text style={[styles.extrasName, { color: colors.text }]}>{pack.name}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  {t('packs_apply_extras')}
                </Text>
              </View>
              <ThemedSwitch
                value={!packsWithoutExtras.includes(pack.id)}
                onValueChange={(value) => onToggleExtras(pack.id, value)}
                testID={`pack-install-extras-${pack.id}`}
              />
            </View>
          ))}
        </View>
      )}
      <Button
        variant={packs.length > 0 ? 'secondary' : 'primary'}
        icon="gift-outline"
        onPress={onBrowse}
        style={styles.browse}
        testID="browse-shipped-packs"
      >
        {t('packs_apply_browse_shipped')}
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 10 },
  extrasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  extrasLabels: { flex: 1, marginRight: 12 },
  extrasName: { fontSize: 16, fontWeight: 'bold' },
  browse: { alignSelf: 'flex-start' },
});

export default StoryPacksPicker;
