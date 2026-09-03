import Button from '@/src/components/common/controls/Button/Button';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/src/theme';

export type GraphConnectionDirection = 'forward' | 'reverse';

interface GraphConnectionModalProps {
  sourceName: string;
  targetName: string;
  /** Boards save a label with their edge; story-location relations deliberately do not. */
  labelEnabled?: boolean;
  directionHint?: string;
  onClose: () => void;
  onConfirm: (connection: {
    directed: boolean;
    direction: GraphConnectionDirection;
    label: string | null;
  }) => void;
}

/** Confirms a drag-created graph link and makes its direction explicit before it is saved. */
const GraphConnectionModal: React.FC<GraphConnectionModalProps> = ({
  sourceName,
  targetName,
  labelEnabled = false,
  directionHint,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [directed, setDirected] = useState(true);
  const [direction, setDirection] = useState<GraphConnectionDirection>('forward');
  const [label, setLabel] = useState('');
  const styles = StyleSheet.create({
    sheet: { padding: 20, gap: 16 },
    header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    title: { flex: 1, color: colors.text, fontSize: 20, fontWeight: '700' },
    close: { padding: 2 },
    description: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
    switchRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    switchLabel: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '600' },
    directions: { gap: 8 },
    directionButton: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    directionButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryContainer,
    },
    directionText: { color: colors.text, flex: 1, fontSize: 15 },
    fieldLabel: { color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 6 },
    input: {
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      color: colors.text,
      fontSize: 16,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    actions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
    cancel: { backgroundColor: colors.surface },
    cancelText: { color: colors.text, fontWeight: '700' },
  });
  const submit = () => onConfirm({ directed, direction, label: label.trim() || null });

  return (
    <ResponsiveModal visible onClose={onClose} placement="center" contentStyle={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('graph_connection_title')}</Text>
        <TouchableOpacity onPress={onClose} style={styles.close} accessibilityLabel={t('close')}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <Text style={styles.description}>
        {t('graph_connection_description', { source: sourceName, target: targetName })}
      </Text>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>{t('graph_connection_directional')}</Text>
        <ThemedSwitch value={directed} onValueChange={setDirected} />
      </View>
      {directed && (
        <>
          <View style={styles.directions}>
            <TouchableOpacity
              style={[
                styles.directionButton,
                direction === 'forward' && styles.directionButtonSelected,
              ]}
              onPress={() => setDirection('forward')}
            >
              <Ionicons name="arrow-forward" size={18} color={colors.primary} />
              <Text style={styles.directionText}>
                {t('graph_connection_forward', { source: sourceName, target: targetName })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.directionButton,
                direction === 'reverse' && styles.directionButtonSelected,
              ]}
              onPress={() => setDirection('reverse')}
            >
              <Ionicons name="arrow-back" size={18} color={colors.primary} />
              <Text style={styles.directionText}>
                {t('graph_connection_reverse', { source: sourceName, target: targetName })}
              </Text>
            </TouchableOpacity>
          </View>
          {directionHint && <Text style={styles.description}>{directionHint}</Text>}
        </>
      )}
      {labelEnabled && (
        <View>
          <Text style={styles.fieldLabel}>{t('graph_connection_label')}</Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder={t('graph_connection_label_placeholder')}
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />
        </View>
      )}
      <View style={styles.actions}>
        <Button onPress={onClose} style={styles.cancel}>
          <Text style={styles.cancelText}>{t('cancel')}</Text>
        </Button>
        <Button onPress={submit}>{t('graph_connection_confirm')}</Button>
      </View>
    </ResponsiveModal>
  );
};

export default GraphConnectionModal;
