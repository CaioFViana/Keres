import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import { useTheme } from '@/src/theme';
import { PAGE_FORMATS, type PageFormat } from '@keres/shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

interface PageFormatSelectProps {
  /** The format chosen for this work, or `null` to take its medium's own. */
  value: PageFormat | null;
  onChange: (format: PageFormat | null) => void;
  disabled?: boolean;
}

/** Sentinel of the "medium's own" choice: the select deals in strings, the model in `null`. */
const MEDIUM_OWN = 'medium';

/** The frame a page's picture is shown in, in a comic or a storyboard. */
const PageFormatSelect: React.FC<PageFormatSelectProps> = ({ value, onChange, disabled }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const options = [
    { label: t('page_format_medium'), value: MEDIUM_OWN },
    ...PAGE_FORMATS.map((format) => ({ label: t(`page_format_${format}`), value: format })),
  ];

  return (
    <View style={styles.container}>
      <SingleSelectPill
        options={options}
        value={value ?? MEDIUM_OWN}
        onValueChange={(next) =>
          next && onChange(next === MEDIUM_OWN ? null : (next as PageFormat))
        }
        placeholder={t('page_format_select')}
        disabled={disabled}
      />
      <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('page_format_hint')}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 6 },
  hint: { fontSize: 13, lineHeight: 18 },
});

export default PageFormatSelect;
