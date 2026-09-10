import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import { useTheme } from '@/src/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

/** Matches `SingleSelectPill` / MultiSelectPill trigger `minHeight`. */
export const LANGUAGE_INSTALL_CONTROL_SIZE = 50;

export interface LanguageInstallOption {
  label: string;
  value: string;
}

interface LanguageInstallRowProps {
  options: LanguageInstallOption[];
  value: string | null;
  onValueChange: (value: string) => void;
  onInstall: () => void;
  installing?: boolean;
  /** Disables the install action (select may still change). */
  installDisabled?: boolean;
  accessibilityLabel: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Language dropdown + square install action used by example-story and shipped-pack catalogues.
 * The action is sized to the select trigger so the row does not look like two mismatched controls.
 */
const LanguageInstallRow: React.FC<LanguageInstallRowProps> = ({
  options,
  value,
  onValueChange,
  onInstall,
  installing = false,
  installDisabled = false,
  accessibilityLabel,
  testID,
  style,
}) => {
  const { colors } = useTheme();
  const actionDisabled = installing || installDisabled || !value;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 12,
        },
        select: {
          flex: 1,
          marginRight: 10,
        },
        installButton: {
          width: LANGUAGE_INSTALL_CONTROL_SIZE,
          height: LANGUAGE_INSTALL_CONTROL_SIZE,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary,
        },
        installButtonDisabled: {
          opacity: 0.5,
        },
      }),
    [colors.primary],
  );

  return (
    <View style={[styles.row, style]}>
      <View style={styles.select}>
        <SingleSelectPill
          options={options}
          value={value}
          onValueChange={(next) => {
            if (!next) return;
            onValueChange(next);
          }}
          disabled={installing}
          style={{ marginBottom: 0 }}
        />
      </View>
      <TouchableOpacity
        style={[styles.installButton, actionDisabled && styles.installButtonDisabled]}
        onPress={onInstall}
        disabled={actionDisabled}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        {installing ? (
          <ActivityIndicator size="small" color={colors.onPrimary} />
        ) : (
          <Ionicons name="download-outline" size={22} color={colors.onPrimary} />
        )}
      </TouchableOpacity>
    </View>
  );
};

export default LanguageInstallRow;
