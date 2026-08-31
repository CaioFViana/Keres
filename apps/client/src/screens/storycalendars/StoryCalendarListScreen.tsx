import { Ionicons } from '@expo/vector-icons';
import {
  calendarDaysPerYear,
  dayNumberToParts,
  formatAttributeDate,
  formatCalendarDate,
  formatGregorianDate,
  gregorianDayNumber,
  gregorianPartsFromDayNumber,
  parseAttributeDate,
  partsToDayNumber,
} from '@keres/shared';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '@/src/db';
import type { StoryCalendarSelect } from '@/src/db/schema';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useStoryCalendar } from '@/src/hooks/useStoryCalendar';
import { useStoryRole } from '@/src/hooks/useStoryRole';
import { useUserSettingsStore } from '@/src/state/userSettingsStore';
import { useNotificationStore } from '@/src/state/notificationStore';
import { useStoryStore } from '@/src/state/storyStore';
import { useTheme } from '@/src/theme';
import { AppAlert } from '@/src/utils/AppAlert';
import { setDocumentTitle } from '@/src/utils/documentTitle';
import { createStoryCalendarService } from '@/src/services/storymanagement/StoryCalendarService';
import { createStoryService } from '@/src/services/storymanagement/StoryService';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import CalendarAnchorsModal from '@/src/components/features/calendars/CalendarAnchorsModal';
import DatePickerInput from '@/src/components/common/inputs/DatePickerInput/DatePickerInput';
import { getCommonInputStyles } from '@/src/theme/commonStyles';

import type { CustomizationStackParamList } from '@/src/navigation/MainSystemStack';

/**
 * The story's calendars.
 *
 * Deliberately not built on `useEntityListScreen` like the other list screens: that machinery exists
 * for hundreds of rows that need searching, tag filters and sorting, and a story has one to three
 * calendars. Wiring it up here would be more code to say less.
 */
const StoryCalendarListScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const db = useDrizzle();
  const story = useStoryStore((state) => state.selectedStory);
  const setSelectedStory = useStoryStore((state) => state.setSelectedStory);
  const { canEdit } = useStoryRole(story?.id);
  const { userId: currentUserId, dateDisplayFormat } = useUserSettingsStore();
  const notify = useNotificationStore((state) => state.showNotification);
  const navigation =
    useNavigation<NativeStackNavigationProp<CustomizationStackParamList, 'StoryCalendarList'>>();
  const { calendars, primary, reload } = useStoryCalendar(story?.id);
  const [busy, setBusy] = useState(false);
  const [inspectedCalendar, setInspectedCalendar] = useState<StoryCalendarSelect | null>(null);
  /*
   * The epoch, edited here rather than on the calendar itself.
   *
   * It belongs to the story: "the story opens on this day" is a fact about the narrative, and it
   * has to survive switching which calendar the reader is reading in. The clock belongs here too:
   * a story that begins at night must still be at night when later dates are calculated.
   */
  const [epoch, setEpoch] = useState({ year: '1', month: '1', day: '1', hour: '0', minute: '0' });
  const [gregorianEpoch, setGregorianEpoch] = useState<string | null>(null);

  useEffect(() => {
    if (story?.timelineEpochDay === null || story?.timelineEpochDay === undefined) {
      return;
    }
    if (!primary) {
      const date = gregorianPartsFromDayNumber(story.timelineEpochDay);
      const seconds = story.timelineEpochSeconds ?? 0;
      setGregorianEpoch(
        formatAttributeDate({
          ...date,
          hour: Math.floor(seconds / 3600),
          minute: Math.floor((seconds % 3600) / 60),
        }),
      );
      return;
    }
    const parts = dayNumberToParts(primary.definition, story.timelineEpochDay);
    const epochSeconds = story.timelineEpochSeconds ?? 0;
    const hour = Math.floor(
      epochSeconds / (primary.definition.minutesPerHour * primary.definition.secondsPerMinute),
    );
    const minute = Math.floor(
      (epochSeconds % (primary.definition.minutesPerHour * primary.definition.secondsPerMinute)) /
        primary.definition.secondsPerMinute,
    );
    setEpoch({
      year: String(parts.year),
      month: String(parts.month),
      day: String(parts.day),
      hour: String(hour),
      minute: String(minute),
    });
  }, [primary, story?.timelineEpochDay, story?.timelineEpochSeconds]);

  useFocusEffect(
    useCallback(() => {
      // The drawer owns the header, so the title has to be set on the parent - see
      // `StorySettingsScreen` for what happens when it is not.
      navigation.getParent()?.setOptions({
        title: t('calendar_list_title'),
        headerRight: canEdit
          ? () => (
              <TouchableOpacity
                onPress={() => navigation.navigate('StoryCalendarForm', {})}
                style={{ marginRight: 15 }}
                accessibilityLabel={t('calendar_add')}
              >
                <Ionicons name="add" size={30} color={colors.text} />
              </TouchableOpacity>
            )
          : undefined,
      });
      setDocumentTitle(t('calendar_list_title'));
      void reload();
    }, [canEdit, colors.text, navigation, reload, t]),
  );

  const promote = useCallback(
    async (calendar: StoryCalendarSelect) => {
      if (!currentUserId || calendar.isPrimary) return;
      setBusy(true);
      try {
        await createStoryCalendarService(db).setPrimary(currentUserId, calendar.id);
        await reload();
      } catch (error) {
        console.log('StoryCalendarListScreen: failed to set the primary calendar.', error);
        notify(t('calendar_save_failed'), 'error');
      } finally {
        setBusy(false);
      }
    },
    [currentUserId, db, notify, reload, t],
  );

  const clearPrimary = useCallback(async () => {
    if (!currentUserId || !story?.id) return;
    setBusy(true);
    try {
      await createStoryCalendarService(db).clearPrimary(currentUserId, story.id);
      await reload();
    } catch (error) {
      console.log('StoryCalendarListScreen: failed to clear the primary calendar.', error);
      notify(t('calendar_save_failed'), 'error');
    } finally {
      setBusy(false);
    }
  }, [currentUserId, db, notify, reload, story?.id, t]);

  const changeMainCalendar = useCallback(
    (change: () => Promise<void>) => {
      const hasEpoch = story?.timelineEpochDay !== null && story?.timelineEpochDay !== undefined;
      if (!hasEpoch) {
        void change();
        return;
      }
      AppAlert.alert(t('calendar_epoch_change_title'), t('calendar_epoch_change_message'), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('calendar_epoch_change_confirm'),
          style: 'destructive',
          onPress: async () => {
            if (!story || !currentUserId) return;
            try {
              const service = createStoryService(db);
              await service.updateStory(currentUserId, story.id, {
                timelineEpochDay: null,
                timelineEpochSeconds: null,
              });
              const refreshed = await service.getStoryById(story.id);
              if (refreshed) setSelectedStory(refreshed as never);
              await change();
            } catch (error) {
              console.log('StoryCalendarListScreen: failed to change the main calendar.', error);
              notify(t('calendar_save_failed'), 'error');
            }
          },
        },
      ]);
    },
    [currentUserId, db, notify, setSelectedStory, story, t],
  );

  const remove = useCallback(
    (calendar: StoryCalendarSelect) => {
      AppAlert.alert(
        t('calendar_delete_title'),
        `${t('calendar_delete_message', { name: calendar.name })}${
          calendar.id === primary?.id &&
          story?.timelineEpochDay !== null &&
          story?.timelineEpochDay !== undefined
            ? `\n\n${t('calendar_epoch_change_message')}`
            : ''
        }`,
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('delete'),
            style: 'destructive',
            onPress: async () => {
              if (!currentUserId) return;
              try {
                if (
                  calendar.id === primary?.id &&
                  story?.timelineEpochDay !== null &&
                  story?.timelineEpochDay !== undefined
                ) {
                  const storyService = createStoryService(db);
                  await storyService.updateStory(currentUserId, story.id, {
                    timelineEpochDay: null,
                    timelineEpochSeconds: null,
                  });
                  const refreshed = await storyService.getStoryById(story.id);
                  if (refreshed) setSelectedStory(refreshed as never);
                }
                await createStoryCalendarService(db).deleteCalendar(currentUserId, calendar.id);
                await reload();
              } catch (error) {
                console.log('StoryCalendarListScreen: failed to delete the calendar.', error);
                notify(t('calendar_save_failed'), 'error');
              }
            },
          },
        ],
      );
    },
    [currentUserId, db, notify, primary?.id, reload, setSelectedStory, story, t],
  );

  const epochDay = useMemo(() => {
    if (!primary) return null;
    return partsToDayNumber(primary.definition, {
      year: Number(epoch.year) || 1,
      month: Number(epoch.month) || 1,
      day: Number(epoch.day) || 1,
    });
  }, [epoch, primary]);

  const epochSeconds = useMemo(() => {
    if (!primary) return 0;
    const hour = Math.min(Math.max(Number(epoch.hour) || 0, 0), primary.definition.hoursPerDay - 1);
    const minute = Math.min(
      Math.max(Number(epoch.minute) || 0, 0),
      primary.definition.minutesPerHour - 1,
    );
    return (
      (hour * primary.definition.minutesPerHour + minute) * primary.definition.secondsPerMinute
    );
  }, [epoch.hour, epoch.minute, primary]);

  const gregorianEpochParts = useMemo(() => parseAttributeDate(gregorianEpoch), [gregorianEpoch]);
  const storedGregorianEpochParts = useMemo(
    () =>
      story?.timelineEpochDay === null || story?.timelineEpochDay === undefined
        ? null
        : gregorianPartsFromDayNumber(story.timelineEpochDay),
    [story?.timelineEpochDay],
  );
  const gregorianEpochIsOutsidePickerRange = Boolean(
    storedGregorianEpochParts &&
      (storedGregorianEpochParts.year < 1 || storedGregorianEpochParts.year > 9999),
  );
  const gregorianEpochDay = useMemo(
    () => (gregorianEpochParts ? gregorianDayNumber(gregorianEpochParts) : null),
    [gregorianEpochParts],
  );
  const gregorianEpochSeconds = useMemo(
    () =>
      gregorianEpochParts
        ? (gregorianEpochParts.hour ?? 0) * 3600 + (gregorianEpochParts.minute ?? 0) * 60
        : 0,
    [gregorianEpochParts],
  );

  const saveEpoch = useCallback(
    async (value: number | null, seconds = epochSeconds) => {
      if (!story || !currentUserId) return;
      setBusy(true);
      try {
        const service = createStoryService(db);
        await service.updateStory(currentUserId, story.id, {
          timelineEpochDay: value,
          timelineEpochSeconds: value === null ? null : seconds,
        });
        // The timeline reads the epoch off the selected story, so the store has to be told: the
        // update returns nothing, and a stale store would leave the dates showing the old day.
        const refreshed = await service.getStoryById(story.id);
        if (refreshed) setSelectedStory(refreshed as never);
      } catch (error) {
        console.log('StoryCalendarListScreen: failed to save the epoch.', error);
        notify(t('calendar_save_failed'), 'error');
      } finally {
        setBusy(false);
      }
    },
    [currentUserId, db, epochSeconds, notify, setSelectedStory, story, t],
  );

  const inputStyles = useMemo(() => getCommonInputStyles(colors), [colors]);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        content: { padding: 14, paddingBottom: 40 },
        intro: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 14 },
        card: {
          backgroundColor: colors.card,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 14,
          marginBottom: 10,
        },
        cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        name: { flexGrow: 1, flexShrink: 1, fontSize: 16, fontWeight: '700', color: colors.text },
        badge: {
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 10,
          backgroundColor: colors.primaryContainer,
        },
        badgeText: { fontSize: 11, fontWeight: '700', color: colors.onPrimaryContainer },
        summary: { fontSize: 12, color: colors.textSecondary, marginTop: 6, lineHeight: 18 },
        actions: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 14,
          marginTop: 12,
          alignItems: 'center',
        },
        action: { flexDirection: 'row', alignItems: 'center', gap: 5 },
        actionText: { fontSize: 13, fontWeight: '700', color: colors.primary },
        empty: { fontSize: 14, color: colors.textSecondary, lineHeight: 21, paddingVertical: 10 },
        epochRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
        epochField: { flexGrow: 1, flexShrink: 1, flexBasis: 90, minWidth: 72 },
        epochLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 3 },
      }),
    [colors],
  );

  /** The one-line shape of a calendar: what a reader needs to tell two of them apart. */
  const summarise = (calendar: StoryCalendarSelect) =>
    t('calendar_summary', {
      months: calendar.definition.months.length,
      days: calendarDaysPerYear(calendar.definition),
      week: calendar.definition.daysPerWeek,
    });

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>{t('calendar_list_intro')}</Text>

        {calendars.length === 0 && <Text style={styles.empty}>{t('calendar_list_empty')}</Text>}

        {!primary && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.name}>{t('calendar_standard_title')}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{t('calendar_primary')}</Text>
              </View>
            </View>
            <Text style={styles.summary}>{t('calendar_standard_hint')}</Text>
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.action}
                onPress={() => navigation.navigate('StoryAgenda')}
                accessibilityRole="button"
                accessibilityLabel={t('calendar_view_agenda')}
              >
                <Ionicons name="calendar-outline" size={17} color={colors.primary} />
                <Text style={styles.actionText}>{t('calendar_view_agenda')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {calendars.map((calendar) => (
          <View key={calendar.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.name}>{calendar.name}</Text>
              {calendar.id === primary?.id && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{t('calendar_primary')}</Text>
                </View>
              )}
            </View>
            <Text style={styles.summary}>{summarise(calendar)}</Text>
            {calendar.description ? (
              <Text style={styles.summary}>{calendar.description}</Text>
            ) : null}

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.action}
                onPress={() => navigation.navigate('StoryAgenda', { calendarId: calendar.id })}
                accessibilityRole="button"
                accessibilityLabel={t('calendar_view_agenda')}
              >
                <Ionicons name="calendar-outline" size={17} color={colors.primary} />
                <Text style={styles.actionText}>{t('calendar_view_agenda')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.action}
                onPress={() => setInspectedCalendar(calendar)}
                accessibilityRole="button"
                accessibilityLabel={t('calendar_view_anchors')}
              >
                <Ionicons name="git-branch-outline" size={17} color={colors.primary} />
                <Text style={styles.actionText}>{t('calendar_view_anchors')}</Text>
              </TouchableOpacity>
        {canEdit && (
                <>
                  <TouchableOpacity
                    style={styles.action}
                    onPress={() =>
                      navigation.navigate('StoryCalendarForm', { calendarId: calendar.id })
                    }
                  >
                    <Ionicons name="create-outline" size={17} color={colors.primary} />
                    <Text style={styles.actionText}>{t('edit')}</Text>
                  </TouchableOpacity>
                  {calendar.id === primary?.id ? (
                    <TouchableOpacity
                      style={styles.action}
                      onPress={() => changeMainCalendar(clearPrimary)}
                      disabled={busy}
                    >
                      <Ionicons name="star-half-outline" size={17} color={colors.textSecondary} />
                      <Text style={[styles.actionText, { color: colors.textSecondary }]}>
                        {t('calendar_clear_primary')}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.action}
                      onPress={() => changeMainCalendar(() => promote(calendar))}
                      disabled={busy}
                    >
                      <Ionicons name="star-outline" size={17} color={colors.primary} />
                      <Text style={styles.actionText}>{t('calendar_make_primary')}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.action} onPress={() => remove(calendar)}>
                    <Ionicons name="trash-outline" size={17} color={colors.error} />
                    <Text style={[styles.actionText, { color: colors.error }]}>{t('delete')}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        ))}

        {primary && (
          <View style={styles.card}>
            <Text style={styles.name}>{t('calendar_epoch_title')}</Text>
            <Text style={styles.summary}>{t('calendar_epoch_hint')}</Text>
            <View style={styles.epochRow}>
              {(['day', 'month', 'year', 'hour', 'minute'] as const).map((part) => (
                <View key={part} style={styles.epochField}>
                  <Text style={styles.epochLabel}>{t(`calendar_epoch_${part}`)}</Text>
                  <TextInput
                    value={epoch[part]}
                    editable={canEdit}
                    onChangeText={(text) => {
                      const acceptsNegative = part === 'day' || part === 'month' || part === 'year';
                      if (text && !(acceptsNegative ? /^-?\d*$/ : /^\d*$/).test(text)) return;
                      setEpoch((current) => ({ ...current, [part]: text }));
                    }}
                    keyboardType="numbers-and-punctuation"
                    style={[inputStyles.input, { marginBottom: 0 }]}
                  />
                </View>
              ))}
            </View>
            {epochDay !== null && (
              <Text style={styles.summary}>
                {formatCalendarDate(primary.definition, epochDay)} ·{' '}
                {String(
                  Math.floor(
                    epochSeconds /
                      (primary.definition.minutesPerHour * primary.definition.secondsPerMinute),
                  ),
                ).padStart(2, '0')}
                :
                {String(
                  Math.floor(
                    (epochSeconds %
                      (primary.definition.minutesPerHour * primary.definition.secondsPerMinute)) /
                      primary.definition.secondsPerMinute,
                  ),
                ).padStart(2, '0')}
              </Text>
            )}
            {canEdit && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.action}
                  onPress={() => saveEpoch(epochDay)}
                  disabled={busy}
                >
                  <Ionicons name="save-outline" size={17} color={colors.primary} />
                  <Text style={styles.actionText}>{t('save')}</Text>
                </TouchableOpacity>
                {story?.timelineEpochDay !== null && story?.timelineEpochDay !== undefined && (
                  <TouchableOpacity
                    style={styles.action}
                    onPress={() => saveEpoch(null)}
                    disabled={busy}
                  >
                    <Ionicons name="backspace-outline" size={17} color={colors.textSecondary} />
                    <Text style={[styles.actionText, { color: colors.textSecondary }]}>
                      {t('calendar_epoch_clear')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {!primary && (
          <View style={styles.card}>
            <Text style={styles.name}>{t('calendar_epoch_title')}</Text>
            <Text style={styles.summary}>{t('calendar_standard_epoch_hint')}</Text>
            {gregorianEpochIsOutsidePickerRange && storedGregorianEpochParts ? (
              <Text style={[styles.summary, { marginTop: 10 }]}>
                {formatGregorianDate(storedGregorianEpochParts, dateDisplayFormat)}
              </Text>
            ) : (
              <DatePickerInput
                value={gregorianEpoch}
                onChange={setGregorianEpoch}
                placeholder={t('calendar_epoch_title')}
                style={{ marginTop: 10, marginBottom: 0 }}
              />
            )}
            {canEdit && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.action}
                  onPress={() => saveEpoch(gregorianEpochDay, gregorianEpochSeconds)}
                  disabled={
                    busy || gregorianEpochDay === null || gregorianEpochIsOutsidePickerRange
                  }
                >
                  <Ionicons name="save-outline" size={17} color={colors.primary} />
                  <Text style={styles.actionText}>{t('save')}</Text>
                </TouchableOpacity>
                {story?.timelineEpochDay !== null && story?.timelineEpochDay !== undefined && (
                  <TouchableOpacity
                    style={styles.action}
                    onPress={() => saveEpoch(null)}
                    disabled={busy}
                  >
                    <Ionicons name="backspace-outline" size={17} color={colors.textSecondary} />
                    <Text style={[styles.actionText, { color: colors.textSecondary }]}>
                      {t('calendar_epoch_clear')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
      {inspectedCalendar && (
        <CalendarAnchorsModal
          visible
          calendarName={inspectedCalendar.name}
          definition={inspectedCalendar.definition}
          onClose={() => setInspectedCalendar(null)}
        />
      )}
    </View>
  );
};

export default StoryCalendarListScreen;
