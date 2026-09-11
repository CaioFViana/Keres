import FormField from '@/src/components/common/forms/FormField/FormField';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import Button from '@/src/components/common/controls/Button/Button';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useStoryRoutes } from '../../hooks/useStoryRoutes';
import type { PlotsStackParamList } from '../../navigation/MainSystemStack';
import { createRouteService } from '../../services/storymanagement/RouteService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';

type Navigation = NativeStackNavigationProp<PlotsStackParamList, 'RouteSteps'>;
type ScreenRoute = RouteProp<PlotsStackParamList, 'RouteSteps'>;
type Step = { sceneId: string; selectedChoiceId: string | null };
const END_ROUTE = '__end_route__';

export default function RouteStepsScreen() {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const db = useDrizzle();
  const navigation = useNavigation<Navigation>();
  const { routeId } = useRoute<ScreenRoute>().params;
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();
  const { routes, scenes, stepsOf, choicesFrom, chapterNameOf, loading } = useStoryRoutes(
    selectedStory?.id,
  );
  const route = routes.find((entry) => entry.id === routeId);
  const [steps, setSteps] = useState<Step[]>([]);
  const [start, setStart] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(
    () =>
      setSteps(
        stepsOf(routeId).map((entry) => ({
          sceneId: entry.sceneId,
          selectedChoiceId: entry.selectedChoiceId,
        })),
      ),
    [routeId, stepsOf],
  );
  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 30 },
        row: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          padding: 12,
          marginTop: 12,
          gap: 8,
        },
        label: { color: colors.textSecondary, fontSize: 13 },
        name: { color: colors.text, fontWeight: '700' },
        help: { color: colors.textSecondary, marginBottom: 12 },
        end: { color: colors.textSecondary, fontStyle: 'italic' },
        change: { color: colors.error, paddingVertical: 6, alignSelf: 'flex-start' },
        primary: { marginTop: 22 },
      }),
    [colors],
  );
  const label = (id: string) => {
    const scene = scenes.find((entry) => entry.id === id);
    const chapter = scene ? chapterNameOf(scene.chapterId) : undefined;
    return `${scene?.name ?? t('unknown_scene')}${chapter ? ` · ${chapter}` : ''}`;
  };
  useScreenHeader({
    target: 'parent',
    title: t('edit_route_steps'),
  });
  const selectStart = (id: string | null) => {
    setStart(id);
    if (id) setSteps([{ sceneId: id, selectedChoiceId: null }]);
  };
  const selectChoice = (index: number, id: string | null) =>
    setSteps((current) => {
      const prefix = current.slice(0, index + 1);
      const active = prefix[index];
      if (!id || id === END_ROUTE)
        return [...prefix.slice(0, -1), { ...active, selectedChoiceId: null }];
      const choice = choicesFrom(active.sceneId).find((entry) => entry.id === id);
      return choice
        ? [
            ...prefix.slice(0, -1),
            { ...active, selectedChoiceId: id },
            { sceneId: choice.nextSceneId, selectedChoiceId: null },
          ]
        : prefix;
    });
  const save = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      await createRouteService(db).replaceSteps(userId, routeId, steps);
      navigation.goBack();
    } catch (error) {
      AppAlert.alert(
        t('error'),
        error instanceof Error ? error.message : t('failed_to_save_route_steps'),
      );
    } finally {
      setSaving(false);
    }
  };
  if (loading || !route) return null;
  return (
    <ScrollView
      style={getCommonContainerStyles(colors).container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.help}>{t('route_steps_guided_help')}</Text>
      {steps.length === 0 ? (
        <>
          <FormField label={t('route_start_scene')}>
            <SingleSelectPill
              options={scenes.map((scene) => ({ value: scene.id, label: label(scene.id) }))}
              value={start}
              onValueChange={selectStart}
              placeholder={t('route_select_start_scene')}
            />
          </FormField>
        </>
      ) : (
        steps.map((step, index) => (
          <View style={styles.row} key={`${step.sceneId}-${index}`}>
            <Text style={styles.label}>{t('route_step_number', { count: index + 1 })}</Text>
            <Text style={styles.name}>{label(step.sceneId)}</Text>
            {choicesFrom(step.sceneId).length ? (
              <>
                <FormField label={t('route_choice')}>
                  <SingleSelectPill
                    options={[
                      { value: END_ROUTE, label: t('route_end_here_option') },
                      ...choicesFrom(step.sceneId).map((choice) => ({
                        value: choice.id,
                        label: choice.text,
                      })),
                    ]}
                    value={step.selectedChoiceId}
                    onValueChange={(id) => selectChoice(index, id)}
                    placeholder={t('route_end_or_select_choice')}
                    allowDeselect
                  />
                </FormField>
              </>
            ) : (
              <Text style={styles.end}>{t('route_no_available_choices')}</Text>
            )}
            {index === steps.length - 1 ? (
              <TouchableOpacity onPress={() => setSteps((current) => current.slice(0, -1))}>
                <Text style={styles.change}>{t('route_change_start')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))
      )}
      <Button onPress={save} disabled={saving || steps.length === 0} style={styles.primary}>
        {t('save_changes')}
      </Button>
    </ScrollView>
  );
}
