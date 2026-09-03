import { Ionicons } from '@expo/vector-icons';
import type { CalendarDefinitionType } from '@keres/shared';
import {
  formatAttributeDate,
  formatGregorianDate,
  dayNumberToParts,
  gregorianDayNumber,
  gregorianPartsFromDayNumber,
  parseAttributeDate,
  partsToDayNumber,
} from '@keres/shared';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TextStyle, ViewStyle } from 'react-native';
import { Text, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import DatePickerInput from '@/src/components/common/inputs/DatePickerInput/DatePickerInput';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { useUserSettingsStore } from '@/src/state/userSettingsStore';
import { useTheme } from '@/src/theme';

export interface AgendaLookupStyles {
  lookup: ViewStyle;
  lookupTitle: TextStyle;
  lookupRow: ViewStyle;
  lookupField: ViewStyle;
  lookupLabel: TextStyle;
  lookupInput: TextStyle;
  lookupYear: ViewStyle;
  lookupMonth: ViewStyle;
  lookupGo: ViewStyle;
}

export const CustomCalendarDateLookup = React.memo(function CustomCalendarDateLookup({
  definition,
  cursor,
  onMonthChange,
  styles,
}: {
  definition: CalendarDefinitionType;
  cursor: number;
  onMonthChange: (day: number) => void;
  styles: AgendaLookupStyles;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const initialParts = useMemo(() => dayNumberToParts(definition, cursor), [definition, cursor]);
  const [yearText, setYearText] = useState(() => String(initialParts.year));
  const [monthValue, setMonthValue] = useState(() => String(initialParts.month));
  const [eraValue, setEraValue] = useState<string | null>(null);

  useEffect(() => {
    const next = dayNumberToParts(definition, cursor);
    setYearText(String(next.year));
    setMonthValue(String(next.month));
  }, [cursor, definition]);

  const open = useCallback(
    (next: { year: number; month: number }) => {
      if (!Number.isInteger(next.year) || !Number.isInteger(next.month)) return;
      onMonthChange(partsToDayNumber(definition, { ...next, day: 1 }));
    },
    [definition, onMonthChange],
  );
  const eras = useMemo(() => {
    const ordered = [...definition.eras].sort((a, b) => a.startYear - b.startYear);
    return ordered.map((era, index) => {
      const next = ordered[index + 1];
      const range =
        era.direction === 'backward'
          ? `≤ ${era.startYear - 1}`
          : `${era.startYear}–${next ? next.startYear - 1 : '∞'}`;
      return { label: `${era.name} (${era.abbreviation}) · ${range}`, value: String(index) };
    });
  }, [definition.eras]);

  return (
    <View style={styles.lookup}>
      <Text style={styles.lookupTitle}>{t('agenda_go_to_date')}</Text>
      {eras.length > 0 && (
        <View style={{ marginBottom: 8, zIndex: 3 }}>
          <Text style={styles.lookupLabel}>{t('calendar_eras')}</Text>
          <SingleSelectPill
            options={eras}
            value={eraValue}
            onValueChange={(value) => {
              setEraValue(value);
              if (value === null) return;
              const era = [...definition.eras].sort((a, b) => a.startYear - b.startYear)[
                Number(value)
              ];
              if (!era) return;
              setYearText(String(era.direction === 'backward' ? era.startYear - 1 : era.startYear));
            }}
            placeholder={t('agenda_pick_era')}
            multiple={false}
          />
        </View>
      )}
      <View style={styles.lookupRow}>
        <View style={[styles.lookupField, styles.lookupYear]}>
          <Text style={styles.lookupLabel}>{t('calendar_epoch_year')}</Text>
          <TextInput
            value={yearText}
            onChangeText={(text) => {
              if (!text || /^-?\d*$/.test(text)) setYearText(text);
            }}
            keyboardType="numbers-and-punctuation"
            style={styles.lookupInput}
          />
        </View>
        <View style={[styles.lookupField, styles.lookupMonth]}>
          <Text style={styles.lookupLabel}>{t('calendar_epoch_month')}</Text>
          <SingleSelectPill
            options={definition.months.map((month, index) => ({
              label: month.name || String(index + 1),
              value: String(index + 1),
            }))}
            value={monthValue}
            onValueChange={(value) => value !== null && setMonthValue(value)}
            multiple={false}
          />
        </View>
        <Button
          onPress={() => open({ year: Number(yearText), month: Number(monthValue) })}
          accessibilityLabel={t('agenda_go_to_date')}
          style={styles.lookupGo}
        >
          <Ionicons name="search-outline" size={20} color={colors.onPrimary} />
        </Button>
      </View>
    </View>
  );
});

/** The regular calendar uses the established date picker as a lookup control, not as a new date model. */
export const GregorianCalendarDateLookup = React.memo(function GregorianCalendarDateLookup({
  cursor,
  onMonthChange,
  styles,
}: {
  cursor: number;
  onMonthChange: (day: number) => void;
  styles: Pick<AgendaLookupStyles, 'lookup' | 'lookupTitle'>;
}) {
  const { t } = useTranslation();
  const dateDisplayFormat = useUserSettingsStore((state) => state.dateDisplayFormat);
  const parts = useMemo(() => gregorianPartsFromDayNumber(cursor), [cursor]);
  const supportsPicker = parts.year >= 1 && parts.year <= 9999;
  const value = useMemo(() => formatAttributeDate({ ...parts, hour: null, minute: null }), [parts]);

  return (
    <View style={styles.lookup}>
      <Text style={styles.lookupTitle}>{t('agenda_go_to_date')}</Text>
      {supportsPicker ? (
        <DatePickerInput
          value={value}
          onChange={(next) => {
            const nextParts = parseAttributeDate(next);
            if (nextParts) onMonthChange(gregorianDayNumber(nextParts));
          }}
          placeholder={t('agenda_go_to_date')}
          style={{ marginBottom: 0 }}
        />
      ) : (
        <Text>{formatGregorianDate(parts, dateDisplayFormat)}</Text>
      )}
    </View>
  );
});
