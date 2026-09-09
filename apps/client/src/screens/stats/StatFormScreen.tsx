import FormField from '@/src/components/common/forms/FormField/FormField';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '../../components/common/controls/Button/Button';
import ThemedSwitch from '../../components/common/controls/ThemedSwitch/ThemedSwitch';
import { ScreenLoading } from '../../components/common/feedback/ScreenState/ScreenState';
import TextInput from '../../components/common/inputs/TextInput/TextInput';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import type { CustomizationStackParamList } from '../../navigation/MainSystemStack';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonInputStyles } from '../../theme/commonStyles';
import { useStatFormActions } from './useStatFormActions';
import { useStatFormResources } from './useStatFormResources';
import { useStatFormState } from './useStatFormState';

type StatFormNavigationProp = NativeStackNavigationProp<CustomizationStackParamList, 'StatForm'>;

const StatFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<StatFormNavigationProp>();
  const route = useRoute<RouteProp<CustomizationStackParamList, 'StatForm'>>();
  const statId = route.params?.statId;
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();
  const storyId = selectedStory?.id;

  const { statServiceRef, data } = useStatFormResources(storyId);
  const statFormState = useStatFormState({
    statId,
    stats: data.stats,
  });
  const { name, setName, isPrimary, setIsPrimary, loading, isEditing } = statFormState;
  const { handleSave, saving } = useStatFormActions({
    state: statFormState,
    statServiceRef,
    navigation,
    storyId,
    userId,
    statsCount: data.stats.length,
  });

  const title = isEditing ? t('stat_form_edit') : t('stat_form_new');

  useScreenHeader({
    target: 'parent',
    title: title,
  });

  const commonInputStyles = getCommonInputStyles(colors);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        label: { color: colors.text, fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
        hint: { color: colors.textSecondary, marginBottom: 12 },
        switchRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        },
        ladderLink: {
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 8,
          padding: 14,
          marginBottom: 20,
        },
        ladderLinkTitle: { color: colors.primary, fontSize: 16, fontWeight: 'bold' },
        ladderLinkHint: { color: colors.textSecondary, marginTop: 4 },
      }),
    [colors],
  );

  if (loading) return <ScreenLoading padded message={t('loading')} />;

  return (
    <EntityFormContainer>
      <FormField label={t('name')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            value={name}
            onChangeText={setName}
            placeholder={t('stat_name_placeholder')}
            style={commonInputStyles.input}
          />
        )}
      </FormField>

      <View style={[styles.switchRow, { marginTop: 20 }]}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={styles.label}>{t('stat_is_primary')}</Text>
          <Text style={styles.hint}>{t('stat_is_primary_hint')}</Text>
        </View>
        <ThemedSwitch value={isPrimary} onValueChange={setIsPrimary} />
      </View>

      {isEditing ? (
        <TouchableOpacity
          style={styles.ladderLink}
          onPress={() => navigation.navigate('StatLadder', { statId })}
        >
          <Text style={styles.ladderLinkTitle}>{t('stat_ladder_title')}</Text>
          <Text style={styles.ladderLinkHint}>{t('stat_ladder_own_hint')}</Text>
        </TouchableOpacity>
      ) : (
        // With no id yet there is nothing to attach the ladder to; it is edited after saving.
        <Text style={styles.hint}>{t('stat_ladder_after_save')}</Text>
      )}

      <Button onPress={handleSave} disabled={saving}>
        {saving ? t('saving') : t('save')}
      </Button>
    </EntityFormContainer>
  );
};

export default StatFormScreen;
