import {
  type CalendarDateCoordinate,
  type CalendarDefinitionType,
  dayNumberToParts,
  partsToDayNumber,
} from '@keres/shared';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';
import CalendarDateFields from '@/src/components/common/inputs/CalendarDateFields/CalendarDateFields';
import { useStoryCalendar } from '@/src/hooks/story/useStoryCalendar';
import { useTheme } from '@/src/theme';
import { defaultCoordinate } from '@/src/utils/calendar/calendarDateFields';

/**
 * A date in the story's own calendar: its primary one, as `CalendarDateFields` writes it.
 *
 * ## Why the value is a day number
 *
 * `AttributeType.DATE` stores a canonical `YYYY-MM-DD` string, validated by round-trip. A calendar
 * of thirteen 28-day months breaks that format outright, so this type stores the integer day
 * instead - which also means renaming a month later changes fifty labels rather than fifty values.
 * The fields and the grid are the shared ones; this only translates between them and that number.
 */

interface Props {
  /** The stored day number, as text. `null` when nothing has been entered. */
  value: string | null;
  onChange: (value: string | null) => void;
  editable?: boolean;
}

const readableCoordinate = (
  definition: CalendarDefinitionType | null,
  value: string | null,
): CalendarDateCoordinate | null => {
  const parsed = value === null || value === '' ? Number.NaN : Number(value);
  if (!definition || !Number.isFinite(parsed)) return null;
  const { year, month, day } = dayNumberToParts(definition, parsed);
  return { year, month, day, hour: 0, minute: 0 };
};

const coordinateOf = (definition: CalendarDefinitionType | null, value: string | null) =>
  readableCoordinate(definition, value) ?? defaultCoordinate();

const StoryDateInput: React.FC<Props> = ({ value, onChange, editable = true }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { definition } = useStoryCalendar();

  /*
   * The fields follow the stored value while it is readable. A value that is not (or none yet) leaves
   * them where they were, so a stray string never wipes what the writer is looking at.
   */
  const [coordinate, setCoordinate] = useState(() => coordinateOf(definition, value));
  const [seen, setSeen] = useState({ definition, value });
  if (seen.definition !== definition || seen.value !== value) {
    setSeen({ definition, value });
    const next = readableCoordinate(definition, value);
    if (next) setCoordinate(next);
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        missing: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
      }),
    [colors],
  );

  /*
   * With no calendar there is nothing to enter a date against, and the field says so rather than
   * offering an input whose value could not be read back.
   */
  if (!definition) return <Text style={styles.missing}>{t('story_date_no_calendar')}</Text>;

  return (
    <CalendarDateFields
      calendar={definition}
      value={coordinate}
      editable={editable}
      onChange={(next) => onChange(String(partsToDayNumber(definition, next)))}
    />
  );
};

export default StoryDateInput;
