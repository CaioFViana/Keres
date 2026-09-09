import Button from '@/src/components/common/controls/Button/Button';
import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import StoryFieldsForm from '@/src/components/features/story/StoryFieldsForm/StoryFieldsForm';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { useNavigation, useRoute } from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useStoryRole } from '../../hooks/useStoryRole';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { useStoryFormActions } from './useStoryFormActions';
import { useStoryFormResources } from './useStoryFormResources';
import { useStoryFormState } from './useStoryFormState';

type RootStackParamList = {
  StoryForm: { storyId?: string };
  StorySelection: undefined;
};

type StoryFormScreenRouteProp = NativeStackScreenProps<RootStackParamList, 'StoryForm'>['route'];
type StoryFormScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'StoryForm'>;

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 4,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

const StoryFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<StoryFormScreenNavigationProp>();
  const route = useRoute<StoryFormScreenRouteProp>();
  const { storyId: initialStoryId } = route.params || {};
  useScreenHeader({
    target: 'parent',
    title: initialStoryId ? t('edit_story') : t('create_new_story_screen_title'),
  });
  const commonContainerStyles = getCommonContainerStyles(colors);
  const { userId } = useUserSettingsStore();

  // Creating is always allowed (there is no role before the story exists); editing respects
  // the real role - the edit button in StorySelectionScreen is not filtered by role, so
  // a reader collaborator can open this screen for somebody else's story. Policy
  // (type / favourites / deletion) belongs to the owner alone; a writer still edits title and content.
  const { canEdit: canEditExisting, canManageStoryPolicy: canManageExistingPolicy } =
    useStoryRole(initialStoryId);
  const canEdit = !initialStoryId || canEditExisting;
  const canManageStoryPolicy = !initialStoryId || canManageExistingPolicy;

  const { storyServiceRef, packServiceRef, packs } = useStoryFormResources(initialStoryId);
  const storyFormState = useStoryFormState({
    initialStoryId,
    storyServiceRef,
    userId,
  });
  const {
    identity,
    selectedPackIds,
    setSelectedPackIds,
    loading,
    error,
    isEditing,
  } = storyFormState;

  const { deleting, handleDelete, handleSave, saving } = useStoryFormActions({
    state: storyFormState,
    storyServiceRef,
    packServiceRef,
    navigation,
    userId,
    canEdit,
    canManageStoryPolicy,
  });

  if (loading) {
    return <ScreenLoading />;
  }

  if (error && !initialStoryId) {
    // Only show error if creating a new story and something went wrong
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <Text style={{ color: colors.error }}>{error}</Text>
        <Button onPress={() => navigation.goBack()}>{t('go_back')}</Button>
      </View>
    );
  }

  return (
    <EntityFormContainer
      title={isEditing ? t('edit_story') : t('create_new_story_screen_title')}
      description={
        isEditing ? t('edit_story_description') : t('create_new_story_screen_description')
      }
      actions={
        <>
          <Button onPress={handleSave} disabled={saving || deleting || !canEdit}>
            {isEditing ? t('update_story') : t('create_story')}
          </Button>
          {isEditing && (
            <Button
              onPress={handleDelete}
              style={{ backgroundColor: colors.error }}
              disabled={saving || deleting || !canManageStoryPolicy}
            >
              {t('delete_story_title')}
            </Button>
          )}
        </>
      }
    >
      {!canEdit && (
        <Text style={{ color: colors.textSecondary, marginBottom: 15 }}>
          {t('story_read_only_error')}
        </Text>
      )}
      {canEdit && !canManageStoryPolicy && (
        <Text style={{ color: colors.textSecondary, marginBottom: 15 }}>
          {t('story_owner_only_error')}
        </Text>
      )}

      <StoryFieldsForm
        {...identity.storyFieldsFormProps}
        onTypeChange={identity.setType}
        typeDisabled={isEditing || !canEdit}
        favoriteBehaviorDisabled={!canManageStoryPolicy}
        editable={canEdit}
      />

      {!isEditing && (
        <>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>
            {t('packs_apply_title')}
          </Text>
          <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
            {t('packs_apply_hint')}
          </Text>
          {packs.length > 0 ? (
            <MultiSelectPill
              options={packs.map((pack) => ({ label: pack.name, value: pack.id }))}
              selectedValues={selectedPackIds}
              onSelectionChange={setSelectedPackIds}
              placeholder={t('packs_apply_title')}
            />
          ) : (
            <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
              {t('packs_apply_none')}
            </Text>
          )}
        </>
      )}
    </EntityFormContainer>
  );
};

export default StoryFormScreen;
