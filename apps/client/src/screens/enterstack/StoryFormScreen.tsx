import Button from '@/src/components/common/controls/Button/Button';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import ArcMediumSelect from '@/src/components/features/arcs/ArcMediumSelect';
import StoryFieldsForm from '@/src/components/features/story/StoryFieldsForm/StoryFieldsForm';
import StoryPacksPicker from '@/src/components/features/story/StoryPacksPicker';
import StoryStartChoice from '@/src/components/features/story/StoryStartChoice';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { useNavigation, useRoute } from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useStoryRole } from '../../hooks/useStoryRole';
import { packHasExtras } from '../../services/storymanagement/PackService';
import { useShippedPacksInstallerStore } from '../../state/shippedPacksInstallerStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { useStoryFormActions } from './useStoryFormActions';
import { useStoryFormResources } from './useStoryFormResources';
import { useStoryFormState } from './useStoryFormState';
import ThemedText from '@/src/components/common/display/ThemedText/ThemedText';

type RootStackParamList = {
  StoryForm: { storyId?: string; start?: 'blank' | 'packs' };
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
  adultsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    marginTop: 4,
  },
  adultsLabels: { flexGrow: 1, flexShrink: 1 },
  adultsTitle: { marginTop: 0 },
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
  const { storyId: initialStoryId, start: initialStart } = route.params || {};
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
  const openInstaller = useShippedPacksInstallerStore((state) => state.openInstaller);
  const lastInstalledPackId = useShippedPacksInstallerStore((state) => state.lastInstalledPackId);
  const storyFormState = useStoryFormState({
    initialStoryId,
    storyServiceRef,
    userId,
    initialStart,
  });
  const {
    identity,
    start,
    setStart,
    selectedPackIds,
    setSelectedPackIds,
    packsWithoutExtras,
    togglePackExtras,
    arcMedium,
    setArcMedium,
    isNsfw,
    setIsNsfw,
    loading,
    error,
    isEditing,
  } = storyFormState;

  // Installing from the overlay reports back through the store (the modal never refocuses this
  // form, so nothing else would notice). The list refetch in `useStoryFormResources` runs on the
  // same signal; this waits for the newcomer to actually be listed before checking it.
  const consumedInstalledPackIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (isEditing || !lastInstalledPackId) return;
    if (consumedInstalledPackIdRef.current === lastInstalledPackId) return;
    if (!packs.some((pack) => pack.id === lastInstalledPackId)) return;
    consumedInstalledPackIdRef.current = lastInstalledPackId;
    if (!selectedPackIds.includes(lastInstalledPackId)) {
      setSelectedPackIds([...selectedPackIds, lastInstalledPackId]);
    }
  }, [isEditing, lastInstalledPackId, packs, selectedPackIds, setSelectedPackIds]);

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
        <ThemedText tone="error">{error}</ThemedText>
        <Button onPress={() => navigation.goBack()}>{t('go_back')}</Button>
      </View>
    );
  }

  return (
    <EntityFormContainer
      planUsage={false}
      title={isEditing ? t('edit_story') : t('create_new_story_screen_title')}
      description={
        isEditing ? t('edit_story_description') : t('create_new_story_screen_description')
      }
      actions={
        <>
          {isEditing && (
            <Button
              onPress={handleDelete}
              variant="destructive"
              disabled={saving || deleting || !canManageStoryPolicy}
            >
              {t('delete_story_title')}
            </Button>
          )}
          <Button onPress={handleSave} disabled={saving || deleting || !canEdit}>
            {isEditing ? t('update_story') : t('create_story')}
          </Button>
        </>
      }
    >
      {!canEdit && (
        <ThemedText tone="secondary" style={{ marginBottom: 15 }}>
          {t('story_read_only_error')}
        </ThemedText>
      )}
      {canEdit && !canManageStoryPolicy && (
        <ThemedText tone="secondary" style={{ marginBottom: 15 }}>
          {t('story_owner_only_error')}
        </ThemedText>
      )}

      {!isEditing && (
        <StoryStartChoice value={start} onChange={setStart} disabled={!canEdit}>
          <StoryPacksPicker
            packs={packs.map((pack) => ({
              id: pack.id,
              name: pack.name,
              hasExtras: packHasExtras(pack.counts),
            }))}
            selectedPackIds={selectedPackIds}
            onSelectionChange={setSelectedPackIds}
            packsWithoutExtras={packsWithoutExtras}
            onToggleExtras={togglePackExtras}
            onBrowse={openInstaller}
          />
        </StoryStartChoice>
      )}

      <StoryFieldsForm
        {...identity.storyFieldsFormProps}
        onTypeChange={identity.setType}
        typeDisabled={isEditing || !canEdit}
        favoriteBehaviorDisabled={!canManageStoryPolicy}
        editable={canEdit}
      />

      {!isEditing && (
        <View style={styles.adultsRow} testID="story-form-nsfw">
          <View style={styles.adultsLabels}>
            <Text style={[styles.sectionLabel, styles.adultsTitle, { color: colors.text }]}>
              {t('story_nsfw')}
            </Text>
            <ThemedText tone="secondary">{t('story_nsfw_description')}</ThemedText>
          </View>
          <ThemedSwitch
            value={isNsfw}
            onValueChange={setIsNsfw}
            disabled={!canEdit}
            testID="story-form-nsfw-switch"
          />
        </View>
      )}

      {!isEditing && (
        <View>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>
            {t('story_form_arc_medium')}
          </Text>
          <ArcMediumSelect
            value={arcMedium}
            onChange={setArcMedium}
            arcTerm={t('arc')}
            hint={t('story_form_arc_medium_hint', { arc: t('arc') })}
            disabled={!canEdit}
          />
        </View>
      )}
    </EntityFormContainer>
  );
};

export default StoryFormScreen;
