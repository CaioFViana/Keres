import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import { useTheme } from '@/src/theme';
import { ARC_MEDIUMS, type ArcMedium } from '@keres/shared/metadata/ArcMedium';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

interface ArcMediumSelectProps {
  value: ArcMedium;
  onChange: (medium: ArcMedium) => void;
  /** The (possibly renamed) word for an Arc, used in the hint. */
  arcTerm: string;
  /** Replaces the default hint, for forms that explain the choice in their own words. */
  hint?: string;
  disabled?: boolean;
}

/** The form of the work: an output profile, never a rule about the data. */
const ArcMediumSelect: React.FC<ArcMediumSelectProps> = ({
  value,
  onChange,
  arcTerm,
  hint,
  disabled,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const options = ARC_MEDIUMS.map((medium) => ({
    label: t(`arc_medium_${medium}`),
    value: medium,
  }));

  return (
    <View style={styles.container}>
      <SingleSelectPill
        options={options}
        value={value}
        onValueChange={(next) => next && onChange(next as ArcMedium)}
        placeholder={t('arc_medium_select')}
        disabled={disabled}
      />
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        {t(`arc_medium_${value}_hint`)}
      </Text>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        {hint ?? t('arc_medium_hint', { arc: arcTerm })}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 6 },
  hint: { fontSize: 13, lineHeight: 18 },
});

export default ArcMediumSelect;
