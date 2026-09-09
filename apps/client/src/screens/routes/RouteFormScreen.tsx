import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import FormField from '@/src/components/common/forms/FormField/FormField';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import Button from '@/src/components/common/controls/Button/Button';
import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import type { PlotsStackParamList } from '../../navigation/MainSystemStack';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonInputStyles } from '../../theme/commonStyles';
import { useRouteFormActions } from './useRouteFormActions';
import { useRouteFormResources } from './useRouteFormResources';
import { useRouteFormState } from './useRouteFormState';

type Navigation = NativeStackNavigationProp<PlotsStackParamList, 'RouteForm'>;
type FormRoute = RouteProp<PlotsStackParamList, 'RouteForm'>;

export default function RouteFormScreen() {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<Navigation>();
  const screenRoute = useRoute<FormRoute>();
  const routeId = screenRoute.params?.routeId;
  const { selectedStory } = useStoryStore();
  const { userId } = useUserSettingsStore();

  const { routeServiceRef } = useRouteFormResources();
  const routeFormState = useRouteFormState({
    routeId,
    routeServiceRef,
  });
  const { name, setName, details, setDetails, loading, isEditing } = routeFormState;
  const { deleting, handleDelete, handleSave, saving } = useRouteFormActions({
    state: routeFormState,
    routeServiceRef,
    navigation,
    storyId: selectedStory?.id,
    userId,
  });

  const input = getCommonInputStyles(colors);
  useScreenHeader({
    target: 'parent',
    title: isEditing ? t('edit_route') : t('create_route'),
  });

  if (loading) return <ScreenLoading />;
  return (
    <EntityFormContainer
      title={isEditing ? t('edit_route') : t('create_route')}
      description={t('route_form_description')}
    >
      <FormField label={t('route_name')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            value={name}
            onChangeText={setName}
            placeholder={t('route_name_placeholder')}
            style={input.input}
          />
        )}
      </FormField>
      <FormField label={t('route_details')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            value={details}
            onChangeText={setDetails}
            placeholder={t('route_details_placeholder')}
            style={input.multiline}
            multiline
          />
        )}
      </FormField>
      {isEditing ? (
        <FormActions stackOnCompact>
          <Button onPress={handleSave} disabled={saving || deleting}>
            {t('save_changes')}
          </Button>
          <Button
            onPress={handleDelete}
            style={{ backgroundColor: colors.error }}
            disabled={saving || deleting}
          >
            {t('delete_route_title')}
          </Button>
        </FormActions>
      ) : (
        <FormActions stackOnCompact>
          <Button onPress={handleSave} disabled={saving || deleting}>
            {t('create_route')}
          </Button>
        </FormActions>
      )}
    </EntityFormContainer>
  );
}
