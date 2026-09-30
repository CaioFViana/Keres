import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';
import { useStoryNavigatorData } from '../../../../hooks/useStoryNavigatorData';
import { useStorySimulation } from '../../../../hooks/useStorySimulation';
import type { NarrativeElementsStackParamList } from '../../../../navigation/MainSystemStack';
import Button from '../../../common/controls/Button/Button';
import { ScreenLoading } from '../../../common/feedback/ScreenState/ScreenState';
import FormField from '../../../common/forms/FormField/FormField';
import { SingleSelectPill } from '../../../common/inputs/MultiSelectPill/MultiSelectPill';
import NavigatorScenePanel from '../../routes/NavigatorScenePanel';

type Navigation = NativeStackNavigationProp<NarrativeElementsStackParamList, 'Manuscript'>;

/**
 * The manuscript of a branching story read the way the Story Navigator walks it: one scene at a
 * time, its choices gated by the items and triggers picked up so far. A route reads one path from
 * start to end; this is for exploring the whole tree.
 */
export default function ManuscriptExplorer({ storyId }: { storyId: string }) {
  const { t } = useTranslation();
  const navigation = useNavigation<Navigation>();
  const { loading, ...data } = useStoryNavigatorData(storyId);
  const simulation = useStorySimulation(data);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: { padding: 16, paddingBottom: 30 },
        restart: { marginTop: 20 },
      }),
    [],
  );

  if (loading) return <ScreenLoading padded message={t('loading_story_navigator')} />;
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <FormField label={t('navigator_start_scene')}>
        <SingleSelectPill
          options={data.scenes.map((scene) => ({ value: scene.id, label: scene.name }))}
          value={simulation.startSceneId}
          onValueChange={simulation.start}
          placeholder={t('route_select_start_scene')}
        />
      </FormField>
      <NavigatorScenePanel
        simulation={simulation}
        content="body"
        onOpenScene={(sceneId) => navigation.navigate('SceneDetail', { sceneId })}
      />
      <Button onPress={() => simulation.reset()} style={styles.restart}>
        {t('navigator_restart')}
      </Button>
    </ScrollView>
  );
}
