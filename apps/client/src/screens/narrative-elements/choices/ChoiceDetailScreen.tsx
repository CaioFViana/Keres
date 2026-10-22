import { DetailTabPanels, DetailTabs } from '@/src/components/layout/DetailTabs/DetailTabs';
import { useDetailTab, useDetailTabItems } from '@/src/hooks/nav/useDetailTab';
import Button from '@/src/components/common/controls/Button/Button';
import { createCommentFieldBindings } from '@/src/components/features/comments/CommentableDetailField/createCommentFieldBindings';
import type { OccurrenceTarget } from '@/src/utils/entity/occurrenceTarget';

import ScreenSection from '@/src/components/layout/ScreenSection/ScreenSection';
import DetailContainer from '@/src/components/layout/DetailContainer/DetailContainer';
import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import DetailField from '@/src/components/common/display/DetailField/DetailField';
import EntityMetadata from '@/src/mentions/EntityMetadataWithBacklinks';
import TagList from '@/src/components/common/display/TagList/TagList';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import CommentableDetailField from '@/src/components/features/comments/CommentableDetailField/CommentableDetailField';
import NoteManager from '@/src/components/features/notes/NoteManager';
import SeeAlsoManager from '@/src/components/features/see-also/SeeAlsoManager/SeeAlsoManager';
import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import { useDetailRecord } from '@/src/hooks/lists/useDetailRecord';
import { useEntityComments } from '@/src/hooks/comments/useEntityComments';
import { useEntityRelations } from '@/src/hooks/relations/useEntityRelations';
import { useStoryRole } from '@/src/hooks/story/useStoryRole';
import { useNavigateToEntityDetail } from '@/src/hooks/nav/useNavigateToEntityDetail';
import { useStoryStore } from '@/src/state/story/storyStore';
import { type ThemeColors, useTheme } from '@/src/theme';
import { layout } from '@/src/theme/layout';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import {
  describeChoiceCheck,
  describeEffect,
} from '@/src/utils/analysis/choiceCheckEffectDescriptions';
import { useVocabularyEntityCopy } from '@/src/hooks/vocabulary/useVocabularyEntityCopy';
import type { NarrativeElementsStackParamList } from '@/src/navigation/drawer/MainSystemDrawer';
import ThemedText from '@/src/components/common/display/ThemedText/ThemedText';
import { useChoiceDetailLists } from './useChoiceDetailLists';
import { useChoiceDetailServices } from './useChoiceDetailServices';

export type ChoiceDetailScreenParamList = {
  ChoiceDetail: { choiceId: string; occurrence?: OccurrenceTarget };
};

type ChoiceDetailScreenRouteProp = RouteProp<ChoiceDetailScreenParamList, 'ChoiceDetail'>;

const ChoiceDetailScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<NarrativeElementsStackParamList, 'ChoiceDetail'>>();
  const route = useRoute<ChoiceDetailScreenRouteProp>();
  const { choiceId, occurrence } = route.params;
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('Choice');
  const sceneCopy = useVocabularyEntityCopy('Scene');
  const { selectedStory } = useStoryStore();

  const services = useChoiceDetailServices();
  const {
    record: choice,
    loading,
    failure,
  } = useDetailRecord({
    id: choiceId,
    load: services.choiceService.getById,
    event: 'choice_changed',
    label: 'choice details',
    onGone: navigation.goBack,
  });
  const isBranching = selectedStory?.type === 'branching';
  const { canEdit } = useStoryRole(choice?.storyId);
  const { commentsByField, canComment, isStoryOwner, currentUserId, addComment, deleteComment } =
    useEntityComments(choice?.storyId, 'Choice', choiceId);

  const {
    selectedTags: choiceTags,
    allNotes,
    noteRelations: choiceNoteRelations,
    saveNoteRelation,
    deleteNoteRelation,
  } = useEntityRelations({ entityType: 'Choice', entityId: choiceId });
  const {
    checkGroups,
    checks,
    effects: choiceEffects,
    sceneNamesById,
    itemNamesById,
  } = useChoiceDetailLists(services, choice?.storyId, choiceId, choice !== null && isBranching);

  const styles = useThemedStyles(createStyles);

  const headerTitle = choice
    ? choice.text || copy.detailsTitle
    : failure === 'notFound'
      ? copy.notFound
      : failure === 'failed'
        ? t('error')
        : t('loading');

  const navigateToDetail = useNavigateToEntityDetail();

  const handleScenePress = useCallback(
    (targetSceneId: string) => {
      navigateToDetail('Scene', targetSceneId);
    },
    [navigateToDetail],
  );

  useScreenHeader({
    target: 'parent',
    title: headerTitle,
    actions: [
      {
        id: 'action-0',
        icon: 'pencil-outline',
        label: t('edit'),
        onPress: () => navigation.navigate('ChoiceForm', { choiceId }),
        visible: !!canEdit,
      },
    ],
  });

  const [tab, setTab] = useDetailTab(occurrence);
  const tabItems = useDetailTabItems(t);

  if (loading) {
    return <ScreenLoading padded message={copy.loadingDetails} />;
  }
  if (failure) {
    return (
      <ScreenError
        padded
        message={failure === 'notFound' ? copy.notFound : copy.failedToLoad}
        onGoBack={() => navigation.goBack()}
      />
    );
  }
  if (!choice) {
    return <ScreenError padded message={copy.dataMissing} onGoBack={() => navigation.goBack()} />;
  }

  const commentField = createCommentFieldBindings({
    storyId: choice.storyId,
    canComment: canComment,
    isStoryOwner: isStoryOwner,
    currentUserId: currentUserId,
    onDeleteComment: deleteComment,
    commentsByField,
    addComment,
  });

  const detailsPanel = (
    <>
      <TagList tags={choiceTags} variant="chip" emptyMessage={t('no_tags_found')} />

      <CommentableDetailField
        {...commentField('text', choice.text || t('common_na'))}
        label={t('text')}
      />

      <CommentableDetailField
        {...commentField('notes', choice.notes || t('common_na'))}
        label={t('choice_notes')}
      />
    </>
  );

  const relationsPanel = (
    <>
      <TouchableOpacity
        onPress={() => handleScenePress(choice.sceneId)}
        style={layout.row}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          <DetailField
            label={sceneCopy.fromEntity}
            value={sceneNamesById[choice.sceneId] || t('common_na')}
          />
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => handleScenePress(choice.nextSceneId)}
        style={layout.row}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          <DetailField
            label={t('next_scene')}
            value={sceneNamesById[choice.nextSceneId] || t('common_na')}
          />
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      {isBranching && (
        <View style={styles.choiceEffectContainer}>
          <ScreenSection title={t('checks_title')} />
          <Text style={styles.sectionDescription}>{t('checks_groups_and_note')}</Text>
          {checkGroups.length === 0 && (
            <DetailField label={t('checks_title')} value={t('no_check_groups')} />
          )}
          {checkGroups.map((group) => {
            const groupChecks = checks.filter((check) => check.groupId === group.id);
            return (
              <View key={group.id} style={styles.card}>
                <Text style={styles.groupLabel}>
                  {group.combinator === 'OR'
                    ? t('check_group_combinator_or_label')
                    : t('check_group_combinator_and_label')}
                </Text>
                {groupChecks.length === 0 && (
                  <ThemedText tone="secondary">{t('no_checks_in_group')}</ThemedText>
                )}
                {groupChecks.map((check) => (
                  <Text
                    key={check.id}
                    style={styles.checkRow}
                  >{`• ${describeChoiceCheck(check, sceneNamesById, itemNamesById, t)}`}</Text>
                ))}
              </View>
            );
          })}

          <ScreenSection title={t('effects_title')} />
          {choiceEffects.length === 0 && (
            <DetailField label={t('effects_title')} value={t('no_effects')} />
          )}
          {choiceEffects.length > 0 && (
            <View style={styles.card}>
              {choiceEffects.map((effect) => (
                <Text
                  key={effect.id}
                  style={styles.checkRow}
                >{`• ${describeEffect(effect, itemNamesById, t)}`}</Text>
              ))}
            </View>
          )}
        </View>
      )}

      <NoteManager
        noteRelations={choiceNoteRelations}
        availableNotes={allNotes}
        onSave={saveNoteRelation}
        onDelete={deleteNoteRelation}
        editable={false}
        currentStoryId={selectedStory?.id || ''}
        currentEntityId={choiceId}
        currentEntityType="Choice"
      />

      <SeeAlsoManager
        storyId={choice.storyId}
        entityType="Choice"
        entityId={choiceId}
        editable={false}
      />
    </>
  );

  const otherPanel = (
    <>
      <EntityMetadata
        version={choice.version}
        createdAt={choice.createdAt}
        updatedAt={choice.updatedAt}
      />
    </>
  );

  return (
    <DetailContainer
      title={choice.text}
      landing={occurrence ?? null}
      footer={
        <>
          <Button onPress={() => navigation.goBack()}>{t('go_back')}</Button>
        </>
      }
      tabs={<DetailTabs tabs={tabItems} value={tab} onChange={setTab} />}
      scrollResetKey={tab}
    >
      <DetailTabPanels
        value={tab}
        panels={{ details: detailsPanel, relations: relationsPanel, other: otherPanel }}
      />
    </DetailContainer>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    sectionDescription: { color: colors.textSecondary, marginBottom: 10 },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      backgroundColor: colors.surface,
    },
    choiceEffectContainer: { marginBottom: 20 },
    checkRow: { color: colors.text, marginTop: 4 },
    groupLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  });

export default ChoiceDetailScreen;
