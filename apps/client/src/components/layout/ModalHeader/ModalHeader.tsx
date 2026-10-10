import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../theme';
import { layout } from '../../../theme/layout';
import { space, typography } from '../../../theme/tokens';

interface ModalHeaderProps {
  title: string;
  /** A line under the title, e.g. the kind of the thing the sheet is about. */
  subtitle?: string;
  /** Shows the close button at the end of the header. */
  onClose?: () => void;
  /** Buttons placed before the close button. */
  actions?: React.ReactNode;
  /** Spoken label of the close button; `close` unless the dialog calls it something else (e.g. cancel). */
  closeLabel?: string;
  closeTestID?: string;
  /** Keeps the close button from acting, e.g. while something is being saved. */
  closeDisabled?: boolean;
  /** Colour of the subtitle, when it carries meaning (the colour of a chapter or a plot). */
  subtitleColor?: string;
  /**
   * An edge-to-edge bar with a line under it, for a sheet that lays out its own width instead of
   * sitting inside the padding of the modal surface (a thread, a viewer, a picker with a back step).
   */
  bordered?: boolean;
  /** Placed before the title, e.g. the button that steps back inside a picker. */
  leading?: React.ReactNode;
  /** Keeps a long title on one line, cut with an ellipsis, so it never pushes the close button off. */
  singleLine?: boolean;
}

/**
 * The top of a modal or sheet: its title, optional actions and the way out. One header for every
 * dialog, so the title size, the spacing under it and the close button do not differ from sheet to sheet.
 */
const ModalHeader: React.FC<ModalHeaderProps> = ({
  title,
  subtitle,
  onClose,
  actions,
  closeLabel,
  closeTestID,
  closeDisabled,
  subtitleColor,
  bordered,
  leading,
  singleLine,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View
      style={[
        layout.row,
        styles.header,
        bordered && [styles.bordered, { borderBottomColor: colors.border }],
      ]}
    >
      {leading}
      <View style={layout.fill}>
        <Text
          accessibilityRole="header"
          numberOfLines={singleLine ? 1 : undefined}
          style={[typography.title, { color: colors.text }]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[
              typography.caption,
              styles.subtitle,
              { color: subtitleColor ?? colors.textSecondary },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actions}
      {onClose ? (
        <TouchableOpacity
          onPress={onClose}
          disabled={closeDisabled}
          testID={closeTestID}
          accessibilityRole="button"
          accessibilityLabel={closeLabel ?? t('close')}
          accessibilityState={{ disabled: !!closeDisabled }}
          hitSlop={8}
        >
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  header: { gap: space.lg, marginBottom: space.md },
  bordered: { padding: space.xl, marginBottom: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  subtitle: { marginTop: space.xxs },
});

export default ModalHeader;
