import {
  type CalendarDefinitionType,
  formatCalendarDateCoordinate,
  parseCalendarDateCoordinate,
} from '@keres/shared';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import FormField from '@/src/components/common/forms/FormField/FormField';
import CalendarDateFields from '@/src/components/common/inputs/CalendarDateFields/CalendarDateFields';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import type { ThemeColors } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import { clampCoordinate, defaultCoordinate } from '@/src/utils/calendar/calendarDateFields';

export interface SceneCalendarOption {
  id: string;
  name: string;
  isPrimary: boolean;
  definition: CalendarDefinitionType;
}

interface Props {
  /** The stored `YYYY-MM-DDTHH:mm`, or empty when the scene has no fixed date. */
  value: string;
  onChange: (value: string) => void;
  /** The calendar the date is written in; `null` is Gregorian. */
  calendarId: string | null;
  onCalendarIdChange: (value: string | null) => void;
  calendars: SceneCalendarOption[];
  /** Without a start date for the story, a fixed date has nothing to be measured from. */
  storyHasEpoch: boolean;
}

const GREGORIAN = '__gregorian__';

/**
 * The date a scene happens on, when the writer knows it exactly.
 *
 * It is an override: without one the scene follows the one before it by its gap. So the field starts
 * as an explanation and a button, not as an empty date, and a date is only there once it is wanted.
 * New dates are written in the story's primary calendar; one saved without a calendar keeps meaning
 * Gregorian, as it always did.
 */
const SceneFixedDateField: React.FC<Props> = ({
  value,
  onChange,
  calendarId,
  onCalendarIdChange,
  calendars,
  storyHasEpoch,
}) => {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);

  const primary = useMemo(() => calendars.find((calendar) => calendar.isPrimary), [calendars]);
  const trimmed = value.trim();
  const coordinate = parseCalendarDateCoordinate(trimmed);
  const definition = calendars.find((calendar) => calendar.id === calendarId)?.definition ?? null;

  const remove = () => {
    onChange('');
    onCalendarIdChange(null);
  };

  const calendarOptions = useMemo(
    () => [
      { label: t('calendar_standard_title'), value: GREGORIAN },
      ...calendars.map((calendar) => ({ label: calendar.name, value: calendar.id })),
    ],
    [calendars, t],
  );

  return (
    <FormField label={t('scene_fixed_date')}>
      {!trimmed ? (
        <View>
          <Text style={styles.hint}>{t('scene_fixed_date_empty_hint')}</Text>
          <Button
            variant="secondary"
            onPress={() => {
              onCalendarIdChange(primary?.id ?? null);
              onChange(formatCalendarDateCoordinate(defaultCoordinate()));
            }}
            testID="scene-fixed-date-set"
          >
            {t('scene_fixed_date_set')}
          </Button>
        </View>
      ) : !coordinate ? (
        // Text that is not a date (an old or imported value): shown as it is so it is not lost, and
        // removable, rather than turned into a date nobody wrote.
        <View>
          <Text style={styles.invalid}>{t('scene_fixed_date_invalid')}</Text>
          <Text style={styles.raw}>{trimmed}</Text>
          <Button variant="secondary" onPress={remove} testID="scene-fixed-date-clear">
            {t('scene_fixed_date_clear')}
          </Button>
        </View>
      ) : (
        <View>
          <Text style={styles.label}>{t('scene_fixed_date_calendar')}</Text>
          <SingleSelectPill
            options={calendarOptions}
            value={calendarId ?? GREGORIAN}
            onValueChange={(next) => {
              if (next === null) return;
              const nextId = next === GREGORIAN ? null : next;
              const nextDefinition =
                calendars.find((calendar) => calendar.id === nextId)?.definition ?? null;
              onCalendarIdChange(nextId);
              onChange(formatCalendarDateCoordinate(clampCoordinate(nextDefinition, coordinate)));
            }}
            placeholder={t('scene_fixed_date_calendar')}
            multiple={false}
          />
          <CalendarDateFields
            calendar={definition}
            value={coordinate}
            onChange={(next) => onChange(formatCalendarDateCoordinate(next))}
            withTime
          />
          <Text style={styles.hint}>{t('scene_fixed_date_hint')}</Text>
          {(!storyHasEpoch || !primary) && (
            <Text style={styles.hint}>{t('scene_fixed_date_needs_calendar')}</Text>
          )}
          <Button variant="secondary" onPress={remove} testID="scene-fixed-date-clear">
            {t('scene_fixed_date_clear')}
          </Button>
        </View>
      )}
    </FormField>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    label: { fontSize: 11, color: colors.textSecondary, marginBottom: 3 },
    hint: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginBottom: 8 },
    invalid: { fontSize: 13, color: colors.error, marginBottom: 4 },
    raw: { fontSize: 13, color: colors.text, marginBottom: 8 },
  });

export default SceneFixedDateField;
