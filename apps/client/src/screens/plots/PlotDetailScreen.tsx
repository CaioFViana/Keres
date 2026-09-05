import Button from '@/src/components/common/controls/Button/Button';
import DetailContainer from '@/src/components/layout/DetailContainer/DetailContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import DetailField from '@/src/components/common/display/DetailField/DetailField';
import EntityMetadata from '@/src/components/features/mentions/EntityMetadataWithBacklinks';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import GenericRelationDisplay from '@/src/components/features/relations/RelationManager/GenericRelationDisplay';
import RelationAttributeLine from '@/src/components/features/relations/RelationManager/RelationAttributeLine';
import { relationSectionStyleDefs } from '@/src/components/features/relations/RelationManager/relationSectionStyles';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import type { PlotSceneSelect, SceneSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useNavigateToEntityDetail } from '../../hooks/useNavigateToEntityDetail';
import { useStoryPlots } from '../../hooks/useStoryPlots';
import { useStoryRole } from '../../hooks/useStoryRole';
import type { PlotsStackParamList } from '../../navigation/MainSystemStack';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { useVocabularyEntityCopy } from '../../vocabulary/useVocabularyEntityCopy';
import type { PlotsScreenNavigationProp } from './PlotListScreen';

type PlotDetailScreenRouteProp = RouteProp<PlotsStackParamList, 'PlotDetail'>;

/**
 * Reading, not editing: name, details and the plot's scenes in narrative order. Scene membership is
 * authored in the Plot form, alongside the plot's own name and details.
 */
const PlotDetailScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const chapterCopy = useVocabularyEntityCopy('Chapter');
  const { colors } = useTheme();
  const navigation = useNavigation<PlotsScreenNavigationProp>();
  const route = useRoute<PlotDetailScreenRouteProp>();
  const { plotId } = route.params;
  const { selectedStory } = useStoryStore();
  const navigateToDetail = useNavigateToEntityDetail();
  // Opening the Scene leaves `PlotsStack` for `NarrativeElementsStack`; without registering the way back, the
  // back button would hand over the Scenes stack where it was, and not this Plot.
  const openScene = useCallback(
    (sceneId: string) =>
      navigateToDetail('Scene', sceneId, {
        onReturn: () =>
          navigation.navigate('PlotsStack', { screen: 'PlotDetail', params: { plotId } }),
      }),
    [navigateToDetail, navigation, plotId],
  );

  const { plotById, relationsOf, sceneById, chapterNameOf, coverageOf, loading } = useStoryPlots(
    selectedStory?.id,
    selectedStory?.type,
  );
  const plot = plotById(plotId);
  const { canEdit } = useStoryRole(plot?.storyId);
  const relations = relationsOf(plotId);
  const coverage = coverageOf(plotId);
  const headerTitle = plot?.name ?? t('plot_details_title');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        ...relationSectionStyleDefs(colors),
        coverage: {
          fontSize: 14,
          color: colors.textSecondary,
          marginBottom: 15,
        },
        sceneNote: {
          fontSize: 14,
          color: colors.textSecondary,
          marginTop: 2,
        },
      }),
    [colors],
  );

  useScreenHeader({
    target: 'parent',
    title: headerTitle,
    actions: [
      {
        id: 'action-0',
        icon: 'pencil-outline',
        label: t('edit_plot'),
        onPress: () => navigation.navigate('PlotForm', { plotId }),
        visible: !!canEdit,
      },
    ],
  });

  if (loading) {
    return <ScreenLoading padded message={t('loading_plot_details')} />;
  }

  if (!plot) {
    return (
      <ScreenError padded message={t('plot_not_found')} onGoBack={() => navigation.goBack()} />
    );
  }

  return (
    <DetailContainer
      title={plot.name}
      footer={
        <>
          <Button onPress={() => navigation.goBack()}>{t('go_back')}</Button>
        </>
      }
    >
      <Text style={styles.coverage}>
        {t('plot_coverage_value', {
          covered: coverage.covered,
          total: coverage.total,
          percentage: coverage.percentage,
        })}
      </Text>

      <DetailField label={t('plot_details')} value={plot.details || t('common_na')} />

      <GenericRelationDisplay<SceneSelect, PlotSceneSelect>
        title={t('plot_scenes')}
        relations={relations}
        getRelatedItem={sceneById}
        getRelationItemId={(relation) => relation.sceneId}
        getItemDisplayName={(scene) => scene.name}
        noItemsMessage="no_plot_scenes"
        renderItemExtraContent={(relation, scene) => (
          <View>
            <Text style={styles.relationText}>{scene.name}</Text>
            {chapterNameOf(scene.chapterId) ? (
              <RelationAttributeLine
                label={chapterCopy.entity}
                value={chapterNameOf(scene.chapterId) as string}
              />
            ) : null}
            <Text style={styles.sceneNote}>{relation.note}</Text>
          </View>
        )}
        onItemPress={(scene) => openScene(scene.id)}
        initialExpanded
      />

      <EntityMetadata
        version={plot.version}
        createdAt={plot.createdAt}
        updatedAt={plot.updatedAt}
        entityType="Plot"
        entityId={plot.id}
      />
    </DetailContainer>
  );
};

export default PlotDetailScreen;
