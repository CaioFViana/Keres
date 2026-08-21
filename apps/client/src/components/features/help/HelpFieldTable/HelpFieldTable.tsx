import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { HelpFieldRow } from '@/src/help/types';
import { useTheme } from '@/src/theme';

export function HelpFieldTable({ rows }: { rows: HelpFieldRow[] }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    box: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
    },
    row: {
      flexDirection: 'row',
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      paddingVertical: 8,
    },
    cell: { flex: 1, color: colors.text, fontSize: 13, paddingRight: 6 },
  });
  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <Text style={styles.cell}>{t('help_field_column_name')}</Text>
        <Text style={styles.cell}>{t('help_field_column_write')}</Text>
        <Text style={styles.cell}>{t('help_field_column_note')}</Text>
      </View>
      {rows.map((row) => (
        <View key={row.key} style={styles.row}>
          <Text style={styles.cell}>{row.label}</Text>
          <Text style={styles.cell}>{row.whatToWrite}</Text>
          <Text style={styles.cell}>{row.note ?? ''}</Text>
        </View>
      ))}
    </View>
  );
}
