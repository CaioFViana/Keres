import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import DatePickerInput from '@/src/components/common/inputs/DatePickerInput/DatePickerInput';
import FormField from '@/src/components/common/forms/FormField/FormField';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { useDrizzle } from '@/src/db';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import { useFormScrollBottomPadding } from '@/src/hooks/forms/useFormScrollBottomPadding';
import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import { useStoryRole } from '@/src/hooks/story/useStoryRole';
import type { NarrativeElementsStackParamList } from '@/src/navigation/drawer/MainSystemDrawer';
import { createChapterService } from '@/src/services/storymanagement/scenes-chapters/ChapterService';
import { startSession } from '@/src/services/storymanagement/scenes-chapters/SessionService';
import { useNotificationStore } from '@/src/state/ui/notificationStore';
import { useStoryStore } from '@/src/state/story/storyStore';
import { useUserSettingsStore } from '@/src/state/app/userSettingsStore';
import { useTheme } from '@/src/theme';
import { getCommonContainerStyles } from '@/src/theme/commonStyles';
import { useStoryVocabulary } from '@/src/hooks/vocabulary/useStoryVocabulary';

type Nav = NativeStackNavigationProp<NarrativeElementsStackParamList, 'NewSession'>;

const today = () => new Date().toISOString().slice(0, 10);

/**
 * The one screen a tabletop campaign needs between sessions: the real date the table met, and nothing
 * else. It opens a new session (a chapter) with its first scene already in it, ready to write what
 * happened; every other detail can wait for the rest of the app. Only offered where the work is a campaign.
 */
const NewSessionScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const db = useDrizzle();
  const story = useStoryStore((state) => state.selectedStory);
  const effectiveArc = useStoryStore((state) => state.effectiveArc);
  const { canEdit } = useStoryRole(story?.id);
  const { userId } = useUserSettingsStore();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const { term } = useStoryVocabulary();
  const scrollBottomPadding = useFormScrollBottomPadding();
  const [playedOn, setPlayedOn] = useState<string | null>(today());
  const [saving, setSaving] = useState(false);

  useScreenHeader({
    target: 'parent',
    title: t('new_session_title', { session: term('Chapter') }),
  });

  const begin = async () => {
    if (!story?.id || !userId || !canEdit || saving) return;
    setSaving(true);
    try {
      const count = (await createChapterService(db).getAllByStoryId(story.id, 'chapter')).length;
      const { scene } = await startSession(db, userId, {
        storyId: story.id,
        arcId: effectiveArc?.id ?? null,
        chapterName: `${term('Chapter')} ${count + 1}`,
        sceneName: `${term('Scene')} 1`,
        playedOn: playedOn ?? today(),
      });
      navigation.replace('SceneEditor', { sceneId: scene.id });
    } catch (error) {
      console.log('NewSessionScreen: failed to start the session.', error);
      showNotification(t('new_session_failed'), 'error');
      setSaving(false);
    }
  };

  const container = getCommonContainerStyles(colors).container;
  return (
    <KeyboardAwareScreen
      style={container}
      contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
    >
      <Text style={[styles.lead, { color: colors.textSecondary }]}>
        {t('new_session_lead', { session: term('Chapter'), scene: term('Scene') })}
      </Text>
      <FormField label={t('new_session_played_on')}>
        <DatePickerInput value={playedOn} onChange={setPlayedOn} />
      </FormField>
      <Button testID="new-session-begin" onPress={() => void begin()} disabled={!canEdit || saving}>
        {t('new_session_begin', { session: term('Chapter') })}
      </Button>
    </KeyboardAwareScreen>
  );
};

const styles = StyleSheet.create({
  lead: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
});

export default NewSessionScreen;
