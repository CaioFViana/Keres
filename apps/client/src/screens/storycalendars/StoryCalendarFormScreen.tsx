import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import type { CalendarDefinitionType } from '@keres/shared';
import { calendarDaysPerYear, CalendarDefinitionSchema } from '@keres/shared';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import CalendarAnchorsModal from '@/src/components/features/calendars/CalendarAnchorsModal';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import type { CalendarRowField } from '@/src/components/features/calendars/CalendarRowList';
import CalendarRowList from '@/src/components/features/calendars/CalendarRowList';
import { useDrizzle } from '@/src/db';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useStoryRole } from '@/src/hooks/useStoryRole';
import type { CustomizationStackParamList } from '@/src/navigation/MainSystemStack';
import { createStoryCalendarService } from '@/src/services/storymanagement/StoryCalendarService';
import { useUserSettingsStore } from '@/src/state/userSettingsStore';
import { useNotificationStore } from '@/src/state/notificationStore';
import { useStoryStore } from '@/src/state/storyStore';
import { useTheme } from '@/src/theme';
import { commonFormStyleDefs, getCommonInputStyles } from '@/src/theme/commonStyles';
import { setDocumentTitle } from '@/src/utils/documentTitle';

/**
 * Describing a calendar.
 *
 * The form is long because a calendar has a lot of small parts, and short because each part is one
 * or two numbers. Only the months are required - a calendar with months and nothing else is a valid
 * one, and every other section can be left empty by a story that does not care about it.
 *
 * The clock, the eras, the moons and the seasons are behind a disclosure for that reason: a writer
 * who wants "13 months of 28 days" should not have to scroll past a moon.
 */
const StoryCalendarFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const db = useDrizzle();
  const route = useRoute<RouteProp<CustomizationStackParamList, 'StoryCalendarForm'>>();
  const navigation =
    useNavigation<NativeStackNavigationProp<CustomizationStackParamList, 'StoryCalendarForm'>>();
  const calendarId = route.params?.calendarId;
  const story = useStoryStore((state) => state.selectedStory);
  const { canEdit } = useStoryRole(story?.id);
  const { userId: currentUserId } = useUserSettingsStore();
  const notify = useNotificationStore((state) => state.showNotification);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [definition, setDefinition] = useState<CalendarDefinitionType>(() =>
    CalendarDefinitionSchema.parse({
      months: [
        { name: '', days: 30 },
        { name: '', days: 30 },
      ],
    }),
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [weekdayText, setWeekdayText] = useState('');
  const [savedDefinition, setSavedDefinition] = useState<CalendarDefinitionType | null>(null);
  const [reviewingCalendarChange, setReviewingCalendarChange] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const title = t(calendarId ? 'calendar_edit_title' : 'calendar_new_title');
      // The drawer owns the header, so the title has to be set on the parent - see
      // `StorySettingsScreen` for what happens when it is not.
      navigation.getParent()?.setOptions({ title, headerRight: undefined });
      setDocumentTitle(title);
    }, [calendarId, navigation, t]),
  );

  useEffect(() => {
    if (!calendarId) return;
    void (async () => {
      const existing = await createStoryCalendarService(db).getById(calendarId);
      if (!existing) return;
      setName(existing.name);
      setDescription(existing.description ?? '');
      setDefinition(existing.definition);
      setSavedDefinition(existing.definition);
      setWeekdayText(existing.definition.weekdayNames.join(', '));
    })();
  }, [calendarId, db]);

  const patch = useCallback(
    (changes: Partial<CalendarDefinitionType>) =>
      setDefinition((current) => ({ ...current, ...changes })),
    [],
  );

  const monthFields = useMemo<CalendarRowField<{ name: string; days: number }>[]>(
    () => [
      {
        key: 'name',
        label: t('calendar_month_name'),
        placeholder: t('calendar_month_name'),
        kind: 'text',
        flex: 3,
      },
      {
        key: 'days',
        label: t('calendar_month_days'),
        placeholder: t('calendar_month_days'),
        kind: 'number',
        flex: 1,
      },
    ],
    [t],
  );
  const changeMonths = useCallback(
    (months: CalendarDefinitionType['months']) => patch({ months }),
    [patch],
  );
  const newMonth = useCallback(() => ({ name: '', days: 30 }), []);

  /**
   * A number field on the definition itself.
   *
   * Empty is kept as 1 rather than 0: every one of these is a divisor somewhere, and a zero would
   * make a year zero days long while the writer is still typing.
   */
  const numberField = (
    key: 'daysPerWeek' | 'hoursPerDay' | 'minutesPerHour' | 'secondsPerMinute',
    label: string,
  ) => (
    <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={String(definition[key])}
        editable={canEdit}
        onChangeText={(text) => {
          if (text && !/^\d+$/.test(text)) return;
          patch({ [key]: Math.max(1, Number(text) || 1) } as Partial<CalendarDefinitionType>);
        }}
        keyboardType="number-pad"
        style={[inputStyles.input, { marginBottom: 0 }]}
      />
    </View>
  );

  const inputStyles = useMemo(() => getCommonInputStyles(colors), [colors]);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        ...commonFormStyleDefs(colors, 40),
        row: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
        summary: {
          fontSize: 13,
          color: colors.textSecondary,
          marginTop: 10,
          lineHeight: 19,
        },
        disclosure: {
          marginTop: 22,
          paddingVertical: 10,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        disclosureText: { fontSize: 15, fontWeight: '700', color: colors.primary },
        buttons: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 26 },
        error: { fontSize: 13, color: colors.error, marginTop: 10, lineHeight: 19 },
      }),
    [colors],
  );

  /*
   * Validation runs on every keystroke rather than on save.
   *
   * A calendar is a pile of interdependent numbers - the seasons depend on the months' total, the
   * weekday names on the length of the week - and finding out at the end which of them disagrees is
   * exactly the experience this form should not have.
   */
  const parsed = CalendarDefinitionSchema.safeParse(definition);
  const problem = parsed.success ? null : parsed.error.issues[0]?.message;

  const persist = useCallback(async () => {
    if (!story || !currentUserId || !parsed.success) return;
    setSaving(true);
    try {
      const service = createStoryCalendarService(db);
      if (calendarId) {
        await service.updateCalendar(currentUserId, calendarId, {
          name: name.trim(),
          description: description.trim() || null,
          definition: parsed.data,
        });
      } else {
        await service.createCalendar(currentUserId, {
          storyId: story.id,
          name: name.trim(),
          description: description.trim() || null,
          definition: parsed.data,
        });
      }
      navigation.goBack();
    } catch (error) {
      console.log('StoryCalendarFormScreen: failed to save the calendar.', error);
      notify(t('calendar_save_failed'), 'error');
    } finally {
      setSaving(false);
    }
  }, [calendarId, currentUserId, db, description, name, navigation, notify, parsed, story, t]);

  const save = useCallback(() => {
    if (!parsed.success) return;
    // Names and descriptions are metadata; every definition change is reviewed because even a
    // renamed month is worth making visible beside the facts that calendar currently interprets.
    if (
      calendarId &&
      savedDefinition &&
      JSON.stringify(savedDefinition) !== JSON.stringify(parsed.data)
    ) {
      setReviewingCalendarChange(true);
      return;
    }
    void persist();
  }, [calendarId, parsed, persist, savedDefinition]);

  return (
    <KeyboardAwareScreen contentContainerStyle={styles.scrollViewContent}>
      <Text style={styles.label}>{t('calendar_name')}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        editable={canEdit}
        placeholder={t('calendar_name_placeholder')}
        style={inputStyles.input}
      />

      <Text style={styles.label}>{t('description')}</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        editable={canEdit}
        placeholder={t('calendar_description_placeholder')}
        multiline
        style={[inputStyles.input, { minHeight: 70, textAlignVertical: 'top' }]}
      />

      <CalendarRowList
        title={t('calendar_months')}
        hint={t('calendar_months_hint')}
        rows={definition.months}
        fields={monthFields}
        blank={newMonth}
        addLabel={t('calendar_add_month')}
        editable={canEdit}
        onChange={changeMonths}
      />
      <Text style={styles.summary}>
        {t('calendar_year_summary', { days: calendarDaysPerYear(definition) })}
      </Text>

      <View style={[styles.row, { marginTop: 18 }]}>
        {numberField('daysPerWeek', t('calendar_days_per_week'))}
      </View>
      <Text style={styles.label}>{t('calendar_weekday_names')}</Text>
      <TextInput
        value={weekdayText}
        editable={canEdit}
        onChangeText={(text) => {
          setWeekdayText(text);
          // Split on save-as-you-type so the schema can complain about the count immediately.
          const names = text
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean);
          patch({ weekdayNames: names });
        }}
        placeholder={t('calendar_weekday_names_placeholder')}
        style={inputStyles.input}
      />

      <TouchableOpacity style={styles.disclosure} onPress={() => setShowAdvanced((on) => !on)}>
        <Text style={styles.disclosureText}>
          {showAdvanced ? t('calendar_hide_more') : t('calendar_show_more')}
        </Text>
      </TouchableOpacity>

      {showAdvanced && (
        <View>
          <Text style={styles.label}>{t('calendar_clock')}</Text>
          <Text style={styles.summary}>{t('calendar_clock_hint')}</Text>
          <View style={styles.row}>
            {numberField('hoursPerDay', t('calendar_hours_per_day'))}
            {numberField('minutesPerHour', t('calendar_minutes_per_hour'))}
            {numberField('secondsPerMinute', t('calendar_seconds_per_minute'))}
          </View>

          <CalendarRowList
            title={t('calendar_eras')}
            hint={t('calendar_eras_hint')}
            rows={definition.eras}
            fields={[
              {
                key: 'name',
                label: t('calendar_era_name'),
                placeholder: t('calendar_era_name'),
                kind: 'text',
                flex: 3,
              },
              {
                key: 'abbreviation',
                label: t('calendar_era_short'),
                placeholder: t('calendar_era_short'),
                kind: 'text',
                flex: 1,
              },
              {
                key: 'startYear',
                label: t('calendar_era_start'),
                placeholder: t('calendar_era_start'),
                kind: 'signed',
                flex: 1,
              },
              {
                key: 'direction',
                label: t('calendar_era_direction'),
                placeholder: t('calendar_era_direction'),
                kind: 'choice',
                flex: 2,
                choices: [
                  { value: 'forward', label: t('calendar_era_forward') },
                  { value: 'backward', label: t('calendar_era_backward') },
                ],
              },
            ]}
            blank={() => ({
              name: '',
              abbreviation: '',
              startYear: 1,
              direction: 'forward' as const,
            })}
            addLabel={t('calendar_add_era')}
            emptyLabel={t('calendar_eras_empty')}
            editable={canEdit}
            onChange={(eras) => patch({ eras })}
          />

          <CalendarRowList
            title={t('calendar_seasons')}
            hint={t('calendar_seasons_hint')}
            rows={definition.seasons}
            fields={[
              {
                key: 'name',
                label: t('calendar_season_name'),
                placeholder: t('calendar_season_name'),
                kind: 'text',
                flex: 3,
              },
              {
                key: 'startDayOfYear',
                label: t('calendar_season_start'),
                placeholder: t('calendar_season_start'),
                kind: 'number',
                flex: 1,
              },
            ]}
            blank={() => ({ name: '', startDayOfYear: 1 })}
            addLabel={t('calendar_add_season')}
            emptyLabel={t('calendar_seasons_empty')}
            editable={canEdit}
            onChange={(seasons) => patch({ seasons })}
          />

          <CalendarRowList
            title={t('calendar_moons')}
            hint={t('calendar_moons_hint')}
            rows={definition.moons}
            fields={[
              {
                key: 'name',
                label: t('calendar_moon_name'),
                placeholder: t('calendar_moon_name'),
                kind: 'text',
                flex: 3,
              },
              {
                key: 'periodDays',
                label: t('calendar_moon_period'),
                placeholder: t('calendar_moon_period'),
                kind: 'decimal',
                flex: 1,
              },
              {
                key: 'referenceDay',
                label: t('calendar_moon_reference'),
                placeholder: t('calendar_moon_reference'),
                kind: 'signed',
                flex: 1,
              },
            ]}
            blank={() => ({ name: '', periodDays: 28, referenceDay: 0 })}
            addLabel={t('calendar_add_moon')}
            emptyLabel={t('calendar_moons_empty')}
            editable={canEdit}
            onChange={(moons) => patch({ moons })}
          />
        </View>
      )}

      {problem ? <Text style={styles.error}>{problem}</Text> : null}

      {canEdit && (
        <FormActions>
          <Button onPress={() => navigation.goBack()}>{t('cancel')}</Button>
          <Button
            onPress={save}
            disabled={saving || !parsed.success || !name.trim()}
            testID="confirm-calendar-save"
          >
            {t('save')}
          </Button>
        </FormActions>
      )}
      {calendarId && savedDefinition && parsed.success && (
        <CalendarAnchorsModal
          visible={reviewingCalendarChange}
          calendarName={name.trim() || t('calendar_edit_title')}
          definition={savedDefinition}
          comparisonDefinition={parsed.data}
          onClose={() => setReviewingCalendarChange(false)}
          onConfirm={() => {
            setReviewingCalendarChange(false);
            void persist();
          }}
          confirming={saving}
        />
      )}
    </KeyboardAwareScreen>
  );
};

export default StoryCalendarFormScreen;
