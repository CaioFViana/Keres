import { Ionicons } from '@expo/vector-icons';
import {
  calendarDaysPerYear,
  dayNumberToParts,
  formatCalendarDate,
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
  const { userId: currentUserId } = useUserSettingsStore();
  const notify = useNotificationStore((state) => state.showNotification);
  const navigation =
    useNavigation<NativeStackNavigationProp<CustomizationStackParamList, 'StoryCalendarList'>>();
  const { calendars, primary, reload } = useStoryCalendar(story?.id);
  const [busy, setBusy] = useState(false);
  /*
   * The epoch, edited here rather than on the calendar itself.
   *
   * It belongs to the story: "the story opens on this day" is a fact about the narrative, and it
   * has to survive switching which calendar the reader is reading in. Three fields rather than a
   * picker - see the plan's §10 on why the month grid stayed out of scope.
   */
  const [epoch, setEpoch] = useState({ year: '1', month: '1', day: '1' });

  useEffect(() => {
    if (!primary || story?.timelineEpochDay === null || story?.timelineEpochDay === undefined) {
      return;
    }
    const parts = dayNumberToParts(primary.definition, story.timelineEpochDay);
    setEpoch({ year: String(parts.year), month: String(parts.month), day: String(parts.day) });
  }, [primary, story?.timelineEpochDay]);

  useFocusEffect(
    useCallback(() => {
      // The drawer owns the header, so the title has to be set on the parent - see
      // `StorySettingsScreen` for what happens when it is not.
      navigation.getParent()?.setOptions({ title: t('calendar_list_title') });
      setDocumentTitle(t('calendar_list_title'));
      void reload();
    }, [navigation, reload, t]),
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

  const remove = useCallback(
    (calendar: StoryCalendarSelect) => {
      AppAlert.alert(
        t('calendar_delete_title'),
        t('calendar_delete_message', { name: calendar.name }),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('delete'),
            style: 'destructive',
            onPress: async () => {
              if (!currentUserId) return;
              try {
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
    [currentUserId, db, notify, reload, t],
  );

  const epochDay = useMemo(() => {
    if (!primary) return null;
    return partsToDayNumber(primary.definition, {
      year: Number(epoch.year) || 1,
      month: Number(epoch.month) || 1,
      day: Number(epoch.day) || 1,
    });
  }, [epoch, primary]);

  const saveEpoch = useCallback(
    async (value: number | null) => {
      if (!story || !currentUserId) return;
      setBusy(true);
      try {
        const service = createStoryService(db);
        await service.updateStory(currentUserId, story.id, { timelineEpochDay: value });
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
    [currentUserId, db, notify, setSelectedStory, story, t],
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
        actions: { flexDirection: 'row', gap: 14, marginTop: 12, alignItems: 'center' },
        action: { flexDirection: 'row', alignItems: 'center', gap: 5 },
        actionText: { fontSize: 13, fontWeight: '700', color: colors.primary },
        empty: { fontSize: 14, color: colors.textSecondary, lineHeight: 21, paddingVertical: 10 },
        add: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 13,
          borderRadius: 8,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: colors.primary,
        },
        addText: { fontSize: 15, fontWeight: '700', color: colors.primary },
        epochRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
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

            {canEdit && (
              <View style={styles.actions}>
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
                  <TouchableOpacity style={styles.action} onPress={clearPrimary} disabled={busy}>
                    <Ionicons name="star-half-outline" size={17} color={colors.textSecondary} />
                    <Text style={[styles.actionText, { color: colors.textSecondary }]}>
                      {t('calendar_clear_primary')}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.action}
                    onPress={() => promote(calendar)}
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
              </View>
            )}
          </View>
        ))}

        {primary && (
          <View style={styles.card}>
            <Text style={styles.name}>{t('calendar_epoch_title')}</Text>
            <Text style={styles.summary}>{t('calendar_epoch_hint')}</Text>
            <View style={styles.epochRow}>
              {(['day', 'month', 'year'] as const).map((part) => (
                <View key={part} style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
                  <Text style={styles.epochLabel}>{t(`calendar_epoch_${part}`)}</Text>
                  <TextInput
                    value={epoch[part]}
                    editable={canEdit}
                    onChangeText={(text) => {
                      if (text && !/^-?\d*$/.test(text)) return;
                      setEpoch((current) => ({ ...current, [part]: text }));
                    }}
                    keyboardType="numbers-and-punctuation"
                    style={[inputStyles.input, { marginBottom: 0 }]}
                  />
                </View>
              ))}
            </View>
            {epochDay !== null && (
              <Text style={styles.summary}>{formatCalendarDate(primary.definition, epochDay)}</Text>
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

        {primary && (
          <TouchableOpacity
            style={[styles.add, { marginBottom: 10, borderStyle: 'solid' }]}
            onPress={() => navigation.navigate('StoryAgenda')}
            accessibilityRole="button"
            accessibilityLabel={t('calendar_view_agenda')}
          >
            <Ionicons name="calendar-outline" size={19} color={colors.primary} />
            <Text style={styles.addText}>{t('calendar_view_agenda')}</Text>
          </TouchableOpacity>
        )}

        {canEdit && (
          <TouchableOpacity
            style={styles.add}
            onPress={() => navigation.navigate('StoryCalendarForm', {})}
          >
            <Ionicons name="add-circle-outline" size={19} color={colors.primary} />
            <Text style={styles.addText}>{t('calendar_add')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

export default StoryCalendarListScreen;
