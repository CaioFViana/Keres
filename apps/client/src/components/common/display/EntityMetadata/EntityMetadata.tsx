import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../../theme';
import CollapsibleCard from '@/src/components/common/display/CollapsibleCard/CollapsibleCard';

export interface EntityMetadataProps {
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Version/Created At/Updated At for any entity's Detail screen.
 *
 * Collapsed by default and visually quiet on purpose: this is bookkeeping a reader almost
 * never needs, not content about the story - it shouldn't compete with the fields that are.
 * Reusable across every entity because those three fields (and their meaning) are identical
 * everywhere; only the values change.
 */
const EntityMetadata: React.FC<EntityMetadataProps> = ({ version, createdAt, updatedAt }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    label: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    value: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '600',
    },
  });

  const formatDateTime = (date: Date) =>
    date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <CollapsibleCard title={t('metadata_title')} initialExpanded={false}>
      <View style={styles.row}>
        <Text style={styles.label}>{t('version')}</Text>
        <Text style={styles.value}>{version}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{t('created_at')}</Text>
        <Text style={styles.value}>{formatDateTime(createdAt)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{t('updated_at')}</Text>
        <Text style={styles.value}>{formatDateTime(updatedAt)}</Text>
      </View>
    </CollapsibleCard>
  );
};

export default EntityMetadata;
