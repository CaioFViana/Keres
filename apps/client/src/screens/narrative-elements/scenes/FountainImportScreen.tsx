import { type FountainImportPlan, planFountainImport } from '@keres/shared';
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { useDrizzle } from '@/src/db';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useFormScrollBottomPadding } from '@/src/hooks/useFormScrollBottomPadding';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { useStoryRole } from '@/src/hooks/useStoryRole';
import { importFountain, titleCase } from '@/src/services/storymanagement/FountainImportService';
import { useNotificationStore } from '@/src/state/notificationStore';
import { useStoryStore } from '@/src/state/storyStore';
import { useUserSettingsStore } from '@/src/state/userSettingsStore';
import { useTheme } from '@/src/theme';
import { getCommonContainerStyles } from '@/src/theme/commonStyles';
import { pickTextFile } from '@/src/utils/storyTransfer';
import { useStoryVocabulary } from '@/src/vocabulary/useStoryVocabulary';

const key = (name: string) => name.replace(/\s+/g, ' ').trim().toUpperCase();

/**
 * Brings a Fountain script in. The file is read and planned first - chapters, scenes, the places and
 * the characters it names - and nothing is written until the person says so; the places and characters
 * are offered as switches, all off, because a script names things (a "KID", an "ALLEY") that are not
 * always worth an entry of their own.
 */
const FountainImportScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const db = useDrizzle();
  const story = useStoryStore((state) => state.selectedStory);
  const effectiveArc = useStoryStore((state) => state.effectiveArc);
  const { canEdit } = useStoryRole(story?.id);
  const { userId } = useUserSettingsStore();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const { term } = useStoryVocabulary();
  const scrollBottomPadding = useFormScrollBottomPadding();
  const [fileName, setFileName] = useState<string | null>(null);
  const [plan, setPlan] = useState<FountainImportPlan | null>(null);
  const [places, setPlaces] = useState<ReadonlySet<string>>(new Set());
  const [characters, setCharacters] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useScreenHeader({ target: 'parent', title: t('fountain_import_title') });

  const choose = async () => {
    if (!canEdit) return;
    try {
      const picked = await pickTextFile();
      if (!picked) return;
      const next = planFountainImport(picked.text);
      setFileName(picked.name);
      setPlan(next);
      setPlaces(new Set());
      setCharacters(new Set());
    } catch (error) {
      console.log('FountainImportScreen: could not read the file.', error);
      showNotification(t('fountain_import_unreadable'), 'error');
    }
  };

  const toggle = (
    current: ReadonlySet<string>,
    set: (next: ReadonlySet<string>) => void,
    name: string,
  ) => {
    const next = new Set(current);
    if (!next.delete(key(name))) next.add(key(name));
    set(next);
  };

  const sceneCount = plan?.sections.reduce((sum, section) => sum + section.scenes.length, 0) ?? 0;

  const begin = async () => {
    if (!story?.id || !userId || !canEdit || !plan || busy || sceneCount === 0) return;
    setBusy(true);
    try {
      const result = await importFountain(db, userId, {
        storyId: story.id,
        arcId: effectiveArc?.id ?? null,
        plan,
        choices: { places, characters },
        fallbackChapterName: plan.title ?? fileName?.replace(/\.[^.]+$/, '') ?? term('Chapter'),
        openingSceneName: t('fountain_import_opening'),
      });
      showNotification(
        t('fountain_import_done', { chapters: result.chapters, scenes: result.scenes }),
        'success',
      );
      navigation.goBack();
    } catch (error) {
      console.log('FountainImportScreen: import failed.', error);
      showNotification(t('fountain_import_failed'), 'error');
      setBusy(false);
    }
  };

  const container = getCommonContainerStyles(colors).container;
  const offer = (
    title: string,
    rows: { name: string; detail: string }[],
    chosen: ReadonlySet<string>,
    set: (next: ReadonlySet<string>) => void,
    testPrefix: string,
  ) =>
    rows.length === 0 ? null : (
      <View style={styles.block}>
        <Text style={[styles.heading, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {t('fountain_import_offer_hint')}
        </Text>
        {rows.map((row) => (
          <View key={row.name} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={{ color: colors.text }}>{titleCase(row.name)}</Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>{row.detail}</Text>
            </View>
            <ThemedSwitch
              value={chosen.has(key(row.name))}
              onValueChange={() => toggle(chosen, set, row.name)}
              testID={`${testPrefix}-${key(row.name)}`}
              accessibilityLabel={titleCase(row.name)}
            />
          </View>
        ))}
      </View>
    );

  return (
    <KeyboardAwareScreen
      style={container}
      contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
    >
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        {t('fountain_import_lead')}
      </Text>
      <Button testID="fountain-choose" onPress={() => void choose()} disabled={!canEdit}>
        {fileName ? t('fountain_import_choose_another') : t('fountain_import_choose')}
      </Button>
      {plan ? (
        <>
          <Text style={[styles.heading, { color: colors.text }]} testID="fountain-summary">
            {sceneCount === 0
              ? t('fountain_import_nothing')
              : t('fountain_import_summary', {
                  file: fileName,
                  chapters: plan.sections.filter((section) => section.scenes.length > 0).length,
                  scenes: sceneCount,
                })}
          </Text>
          {offer(
            t('fountain_import_places', { places: term('Location') }),
            plan.places.map((place) => ({
              name: place.name,
              detail: t('fountain_import_place_scenes', { count: place.scenes }),
            })),
            places,
            setPlaces,
            'fountain-place',
          )}
          {offer(
            t('fountain_import_characters', { characters: term('Character') }),
            plan.characters.map((character) => ({
              name: character.name,
              detail: t('fountain_import_character_cues', { count: character.cues }),
            })),
            characters,
            setCharacters,
            'fountain-character',
          )}
          <Button
            testID="fountain-import"
            onPress={() => void begin()}
            disabled={!canEdit || busy || sceneCount === 0}
          >
            {t('fountain_import_begin')}
          </Button>
        </>
      ) : null}
    </KeyboardAwareScreen>
  );
};

const styles = StyleSheet.create({
  heading: { fontSize: 17, fontWeight: '700', marginVertical: 12 },
  hint: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  block: { marginBottom: 12 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingVertical: 6 },
  rowText: { flex: 1 },
});

export default FountainImportScreen;
