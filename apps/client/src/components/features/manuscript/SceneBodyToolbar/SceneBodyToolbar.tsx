import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../theme';
import type { ManuscriptMark } from '@keres/shared';

export type ManuscriptBlockAction = 'bullet' | 'ordered';

const MARK_ACTIONS: { kind: ManuscriptMark; glyph: string; labelKey: string }[] = [
  { kind: 'bold', glyph: 'B', labelKey: 'manuscript_format_bold' },
  { kind: 'italic', glyph: 'I', labelKey: 'manuscript_format_italic' },
  { kind: 'underline', glyph: 'U', labelKey: 'manuscript_format_underline' },
  { kind: 'strikethrough', glyph: 'S', labelKey: 'manuscript_format_strikethrough' },
];

const LIST_ACTIONS: { kind: ManuscriptBlockAction; glyph: string; labelKey: string }[] = [
  { kind: 'bullet', glyph: '•', labelKey: 'manuscript_format_bullet' },
  { kind: 'ordered', glyph: '1.', labelKey: 'manuscript_format_ordered' },
];

/**
 * Fixed formatting row above the prose input: bold, italic, underline,
 * strikethrough, plus bulleted and numbered lists. A dumb button row - the
 * native editor owns the logic and the `active` map (from its style state)
 * drives the primary highlight (marks only: the editor reports no list state).
 */
export function SceneBodyToolbar({
  onAction,
  disabled = false,
  active = {},
  testID,
}: {
  onAction(kind: ManuscriptMark | ManuscriptBlockAction): void;
  disabled?: boolean;
  active?: Partial<Record<ManuscriptMark, boolean>>;
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
        glyph: { color: colors.text, fontSize: 16 },
        glyphList: { fontWeight: '700', fontSize: 15 },
        glyphBold: { fontWeight: '700' },
        glyphItalic: { fontStyle: 'italic' },
        glyphUnderline: { textDecorationLine: 'underline' },
        glyphStrikethrough: { textDecorationLine: 'line-through' },
        glyphActive: { color: colors.primary },
        disabled: { opacity: 0.4 },
      }),
    [colors],
  );
  return (
    <View style={styles.row} testID={testID}>
      {MARK_ACTIONS.map((action) => {
        const isActive = active[action.kind] ?? false;
        return (
          <TouchableOpacity
            key={action.kind}
            testID={testID ? `${testID}.${action.kind}` : undefined}
            // Never steal the editor's input focus (Android): tapping a mark
            // must keep the keyboard up and the caret where it was.
            focusable={false}
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
                action.kind === 'strikethrough' && styles.glyphStrikethrough,
                isActive && styles.glyphActive,
              ]}
            >
              {action.glyph}
            </Text>
          </TouchableOpacity>
        );
      })}
      {LIST_ACTIONS.map((action) => (
        <TouchableOpacity
          key={action.kind}
          testID={testID ? `${testID}.${action.kind}` : undefined}
          // Like the marks above: formatting must not steal the caret.
          focusable={false}
          accessibilityRole="button"
          accessibilityLabel={t(action.labelKey)}
          style={[styles.button, disabled && styles.disabled]}
          disabled={disabled}
          onPress={() => onAction(action.kind)}
        >
          <Text style={[styles.glyph, styles.glyphList]}>{action.glyph}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
