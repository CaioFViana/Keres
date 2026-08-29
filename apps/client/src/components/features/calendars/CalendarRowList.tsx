import { Ionicons } from '@expo/vector-icons';
import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { useTheme } from '@/src/theme';

/**
 * A repeatable row of small fields: months, eras, seasons, moons.
 *
 * All four are the same shape - an ordered list where each entry is a name plus one or two numbers -
 * and writing four near-identical blocks in the calendar form would be four places to fix the same
 * layout bug. The columns are declared, the editing is generic.
 */

export interface CalendarRowField<T> {
  key: keyof T & string;
  placeholder: string;
  /** Numeric fields are typed digit-by-digit; `signed` also allows a leading minus. */
  kind: 'text' | 'number' | 'signed' | 'decimal' | 'choice';
  choices?: { value: string; label: string }[];
  /** Relative width against the other columns. */
  flex: number;
}

interface Props<T> {
  title: string;
  hint?: string;
  rows: T[];
  fields: CalendarRowField<T>[];
  /** A blank row, used when the writer adds one. */
  blank: () => T;
  addLabel: string;
  emptyLabel?: string;
  editable: boolean;
  onChange: (rows: T[]) => void;
}

/** What a partially typed number looks like, so a half-typed `-` or `.` is not thrown away. */
const isTypable = (kind: CalendarRowField<never>['kind'], text: string) => {
  if (kind === 'text' || kind === 'choice') return true;
  if (text === '') return true;
  if (kind === 'number') return /^\d+$/.test(text);
  if (kind === 'signed') return /^-?\d*$/.test(text);
  return /^-?\d*\.?\d*$/.test(text);
};

function CalendarRowList<T extends Record<string, unknown>>({
  title,
  hint,
  rows,
  fields,
  blank,
  addLabel,
  emptyLabel,
  editable,
  onChange,
}: Props<T>) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        title: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 18 },
        hint: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginTop: 4 },
        row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
        input: { marginBottom: 0, width: undefined },
        empty: { fontSize: 13, color: colors.textSecondary, marginTop: 8 },
        add: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
        addText: { fontSize: 14, fontWeight: '700', color: colors.primary },
      }),
    [colors],
  );

  // The parent validates the entire definition on every edit. Keep the row callbacks stable and
  // read the latest rows from a ref so that unrelated form sections do not need to recreate their
  // native text inputs while someone is typing in this list.
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const patch = useCallback(
    (index: number, key: string, raw: string, kind: CalendarRowField<T>['kind']) => {
      const next = [...rowsRef.current];
      /*
       * Text is stored as typed; numbers are stored as numbers, with a half-finished entry ("-", "",
       * "3.") landing as 0. The row keeps the raw string nowhere, so the field re-renders from the
       * number - which is why `isTypable` has to let those intermediate states through first.
       */
      const value =
        kind === 'text' || kind === 'choice'
          ? raw
          : Number(raw === '' || raw === '-' ? 0 : raw) || 0;
      next[index] = { ...next[index], [key]: value };
      onChange(next);
    },
    [onChange],
  );

  const remove = useCallback(
    (index: number) => onChange(rowsRef.current.filter((_, other) => other !== index)),
    [onChange],
  );

  const add = useCallback(() => onChange([...rowsRef.current, blank()]), [blank, onChange]);

  return (
    <View>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      {rows.length === 0 && emptyLabel ? <Text style={styles.empty}>{emptyLabel}</Text> : null}

      {rows.map((row, index) => (
        // The index is the identity: these lists have no ids, and reordering is not offered.
        <View key={index} style={styles.row}>
          {fields.map((field) => (
            <View key={field.key} style={{ flexGrow: field.flex, flexShrink: 1, flexBasis: 0 }}>
              {field.kind === 'choice' ? (
                <TouchableOpacity
                  style={styles.input}
                  disabled={!editable}
                  onPress={() => {
                    const choices = field.choices ?? [];
                    const current = String(row[field.key] ?? '');
                    const choiceIndex = choices.findIndex((choice) => choice.value === current);
                    const next = choices[(choiceIndex + 1) % choices.length];
                    if (next) patch(index, field.key, next.value, field.kind);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={field.placeholder}
                >
                  <Text style={{ color: colors.text }} numberOfLines={1}>
                    {field.choices?.find((choice) => choice.value === row[field.key])?.label ??
                      field.placeholder}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TextInput
                  placeholder={field.placeholder}
                  value={String(row[field.key] ?? '')}
                  editable={editable}
                  onChangeText={(text) => {
                    if (!isTypable(field.kind, text)) return;
                    patch(index, field.key, text, field.kind);
                  }}
                  keyboardType={field.kind === 'text' ? 'default' : 'numbers-and-punctuation'}
                  style={styles.input}
                />
              )}
            </View>
          ))}
          {editable && (
            <TouchableOpacity onPress={() => remove(index)} accessibilityLabel={t('delete')}>
              <Ionicons name="close-circle-outline" size={22} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      ))}

      {editable && (
        <TouchableOpacity style={styles.add} onPress={add}>
          <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.addText}>{addLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default memo(CalendarRowList) as typeof CalendarRowList;
