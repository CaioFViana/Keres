import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../theme';

/**
 * The loading / error / empty screens every entity screen was rebuilding by hand.
 *
 * Each of the ~27 screens declared its own `container` + `centerContent` + `detailText`
 * + `errorText` styles and repeated the same JSX, so a change to how loading looks meant
 * editing dozens of files. `padded` matches the detail screens, which add padding around
 * the whole screen; list screens leave it off.
 */

interface ScreenStateProps {
  /** Detail screens pad their container; list screens hand the full width to the list. */
  padded?: boolean;
}

const useScreenStateStyles = (padded: boolean) => {
  const { colors } = useTheme();
  return {
    colors,
    styles: StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        ...(padded ? { padding: 20 } : {}),
      },
      message: {
        fontSize: 16,
        color: colors.text,
        marginBottom: 5,
        textAlign: 'center',
      },
      errorMessage: {
        color: colors.error,
      },
      actionContainer: {
        marginTop: 20,
      },
    }),
  };
};

export const ScreenLoading: React.FC<ScreenStateProps & { message?: string }> = ({ message, padded }) => {
  const { t } = useTranslation();
  const { colors, styles } = useScreenStateStyles(!!padded);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.message}>{message ?? `${t('loading')}...`}</Text>
    </View>
  );
};

export const ScreenError: React.FC<ScreenStateProps & {
  message: string;
  /** Usually `navigation.goBack`. Omit to render the message with no action. */
  onGoBack?: () => void;
}> = ({ message, onGoBack, padded }) => {
  const { t } = useTranslation();
  const { colors, styles } = useScreenStateStyles(!!padded);

  return (
    <View style={styles.container}>
      <Text style={[styles.message, styles.errorMessage]}>{message}</Text>
      {onGoBack && (
        <View style={styles.actionContainer}>
          <Button title={t('go_back')} onPress={onGoBack} color={colors.primary} />
        </View>
      )}
    </View>
  );
};
