import Button from '@/src/components/common/controls/Button/Button';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import ModalHeader from '@/src/components/layout/ModalHeader/ModalHeader';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { type ThemeColors, useTheme } from '@/src/theme';
import { typography } from '@/src/theme/tokens';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export type GraphConnectionDirection = 'forward' | 'reverse';

interface GraphConnectionModalProps {
  sourceName: string;
  targetName: string;
  /** Boards save a label with their edge; story-location relations deliberately do not. */
  labelEnabled?: boolean;
  /** Schema limit of the label being written; each caller passes its own. */
  labelMaxLength?: number;
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
  labelMaxLength,
  directionHint,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [directed, setDirected] = useState(true);
  const [direction, setDirection] = useState<GraphConnectionDirection>('forward');
  const [label, setLabel] = useState('');
  const styles = useThemedStyles(createStyles);
  const submit = () => onConfirm({ directed, direction, label: label.trim() || null });

  return (
    <ResponsiveModal
      visible
      onClose={onClose}
      placement="center"
      inset="roomy"
      contentStyle={styles.sheet}
    >
      <ModalHeader title={t('graph_connection_title')} onClose={onClose} />
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
            maxLength={labelMaxLength}
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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    sheet: { gap: 16 },
    description: { ...typography.body, color: colors.textSecondary },
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
      paddingVertical: 12,
    },
    directionButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryContainer,
    },
    directionText: { color: colors.text, flex: 1, fontSize: 15 },
    fieldLabel: { ...typography.label, color: colors.text, marginBottom: 6 },
    input: {
      ...typography.bodyLarge,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      color: colors.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    actions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
    cancel: { backgroundColor: colors.surface },
    cancelText: { color: colors.text, fontWeight: '700' },
  });

export default GraphConnectionModal;
