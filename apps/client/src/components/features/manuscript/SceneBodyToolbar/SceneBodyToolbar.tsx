import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../theme';
import type { ManuscriptFormatKind } from '../manuscriptDocumentEngine';

const ACTIONS: { kind: ManuscriptFormatKind; glyph: string; labelKey: string }[] = [
  { kind: 'bold', glyph: 'B', labelKey: 'manuscript_format_bold' },
  { kind: 'italic', glyph: 'I', labelKey: 'manuscript_format_italic' },
  { kind: 'underline', glyph: 'U', labelKey: 'manuscript_format_underline' },
  { kind: 'heading', glyph: 'H', labelKey: 'manuscript_format_heading' },
  { kind: 'strikethrough', glyph: 'S', labelKey: 'manuscript_format_strikethrough' },
];

/**
 * Fixed formatting row above the prose input: bold, italic, underline, a
 * heading cycler and strikethrough. A dumb button row -
 * The document engine owns the logic and the `active` map (from
 * `getEditorActiveMarks`) drives the primary highlight.
 */
export function SceneBodyToolbar({
  onAction,
  disabled = false,
  active = {},
  testID,
}: {
  onAction(kind: ManuscriptFormatKind): void;
  disabled?: boolean;
  active?: Partial<Record<ManuscriptFormatKind, boolean>>;
  testID?: string;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 4,
          gap: 4,
          backgroundColor: colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        button: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
        glyph: { color: colors.text, fontSize: 17 },
        glyphBold: { fontWeight: '700' },
        glyphItalic: { fontStyle: 'italic' },
        glyphUnderline: { textDecorationLine: 'underline' },
        glyphHeading: { fontWeight: '700' },
        glyphStrikethrough: { textDecorationLine: 'line-through' },
        glyphActive: { color: colors.primary },
        disabled: { opacity: 0.4 },
      }),
    [colors],
  );
  return (
    <View style={styles.row} testID={testID}>
      {ACTIONS.map((action) => {
        const isActive = active[action.kind] ?? false;
        return (
          <TouchableOpacity
            key={action.kind}
            testID={testID ? `${testID}.${action.kind}` : undefined}
            accessibilityRole="button"
            accessibilityLabel={t(action.labelKey)}
            accessibilityState={{ selected: isActive }}
            style={[styles.button, disabled && styles.disabled]}
            disabled={disabled}
            onPress={() => onAction(action.kind)}
          >
            <Text
              style={[
                styles.glyph,
                action.kind === 'bold' && styles.glyphBold,
                action.kind === 'italic' && styles.glyphItalic,
                action.kind === 'underline' && styles.glyphUnderline,
                action.kind === 'heading' && styles.glyphHeading,
                action.kind === 'strikethrough' && styles.glyphStrikethrough,
                isActive && styles.glyphActive,
              ]}
            >
              {action.glyph}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
