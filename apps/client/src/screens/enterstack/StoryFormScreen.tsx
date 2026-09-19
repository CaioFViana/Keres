import Button from '@/src/components/common/controls/Button/Button';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import StoryFieldsForm from '@/src/components/features/story/StoryFieldsForm/StoryFieldsForm';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useScreenAnchor } from '../../guides/useGuideAnchor';
import { useScreenTour } from '../../guides/useScreenTour';
import { useStoryRole } from '../../hooks/useStoryRole';
import { packHasExtras } from '../../services/storymanagement/PackService';
import { useShippedPacksInstallerStore } from '../../state/shippedPacksInstallerStore';
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
  browseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 8,
  },
  browseText: { fontSize: 14, marginLeft: 6 },
  extrasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  extrasLabels: { flex: 1, marginRight: 12 },
  extrasName: { fontSize: 16, fontWeight: 'bold' },
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
  // The creation tour only: editing keeps the form quiet, so edits resolve to an id with no guide.
  useScreenTour(initialStoryId ? 'StoryFormEdit' : 'StoryForm');
  const packsAnchorRef = useScreenAnchor('StoryForm', 'packs');
  const extrasAnchorRef = useScreenAnchor('StoryForm', 'extras');
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
  });
  const {
    identity,
    selectedPackIds,
    setSelectedPackIds,
    packsWithoutExtras,
    togglePackExtras,
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

  const browseShippedPacks = (
    <TouchableOpacity
      style={styles.browseRow}
      onPress={openInstaller}
      testID="browse-shipped-packs"
      accessibilityRole="button"
    >
      <Ionicons name="gift-outline" size={18} color={colors.primary} />
      <Text style={[styles.browseText, { color: colors.primary }]}>
        {t('packs_apply_browse_shipped')}
      </Text>
    </TouchableOpacity>
  );

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
        <View ref={packsAnchorRef} collapsable={false}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>
            {t('packs_apply_title')}
          </Text>
          <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
            {t('packs_apply_hint')}
          </Text>
          {packs.length > 0 ? (
            <>
              <MultiSelectPill
                options={packs.map((pack) => ({ label: pack.name, value: pack.id }))}
                selectedValues={selectedPackIds}
                onSelectionChange={setSelectedPackIds}
                placeholder={t('packs_apply_title')}
              />
              {packs.some(
                (pack) => selectedPackIds.includes(pack.id) && packHasExtras(pack.counts),
              ) && (
                <View ref={extrasAnchorRef} collapsable={false}>
                  <Text style={{ color: colors.textSecondary, marginBottom: 8, marginTop: 8 }}>
                    {t('packs_apply_extras_hint')}
                  </Text>
                  {packs
                    .filter(
                      (pack) => selectedPackIds.includes(pack.id) && packHasExtras(pack.counts),
                    )
                    .map((pack) => (
                      <View key={pack.id} style={styles.extrasRow}>
                        <View style={styles.extrasLabels}>
                          <Text style={[styles.extrasName, { color: colors.text }]}>
                            {pack.name}
                          </Text>
                          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                            {t('packs_apply_extras')}
                          </Text>
                        </View>
                        <ThemedSwitch
                          value={!packsWithoutExtras.includes(pack.id)}
                          onValueChange={(value) => togglePackExtras(pack.id, value)}
                          testID={`pack-install-extras-${pack.id}`}
                        />
                      </View>
                    ))}
                </View>
              )}
              {browseShippedPacks}
            </>
          ) : (
            <>
              <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
                {t('packs_apply_none')}
              </Text>
              {browseShippedPacks}
            </>
          )}
        </View>
      )}
    </EntityFormContainer>
  );
};

export default StoryFormScreen;
