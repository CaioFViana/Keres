import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import { useAsyncOperation } from '@/src/hooks/useAsyncOperation';
import FormField from '@/src/components/common/forms/FormField/FormField';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import Button from '@/src/components/common/controls/Button/Button';
import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import type { PlotsStackParamList } from '../../navigation/MainSystemStack';
import { createRouteService } from '../../services/storymanagement/RouteService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonInputStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Navigation = NativeStackNavigationProp<PlotsStackParamList, 'RouteForm'>;
type FormRoute = RouteProp<PlotsStackParamList, 'RouteForm'>;

export default function RouteFormScreen() {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const db = useDrizzle();
  const navigation = useNavigation<Navigation>();
  const screenRoute = useRoute<FormRoute>();
  const routeId = screenRoute.params?.routeId;
  const { selectedStory } = useStoryStore();
  const { userId } = useUserSettingsStore();
  const confirmDelete = useConfirmDelete();
  const [name, setName] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(Boolean(routeId));
  const { pending: saving, run: runSave } = useAsyncOperation();
  const [deleting, setDeleting] = useState(false);
  const service = useCallback(() => createRouteService(db), [db]);
  const input = getCommonInputStyles(colors);
  useScreenHeader({
    target: 'parent',
    title: routeId ? t('edit_route') : t('create_route'),
  });
  useEffect(() => {
    if (!routeId) {
      setLoading(false);
      return;
    }
    service()
      .getById(routeId)
      .then((route) => {
        if (route) {
          setName(route.name);
          setDetails(route.details ?? '');
        }
      })
      .finally(() => setLoading(false));
  }, [routeId, service]);
  const save = () =>
    runSave(async () => {
      if (!selectedStory?.id || !userId || !name.trim()) {
        AppAlert.alert(
          t('error'),
          !name.trim() ? t('route_name_required') : t('user_not_identified'),
        );
        return;
      }

      try {
        const saved = await service().save(userId, {
          id: routeId,
          storyId: selectedStory.id,
          name,
          details: details.trim() || null,
        });
        if (routeId) navigation.goBack();
        else navigation.replace('RouteDetail', { routeId: saved.id });
      } catch {
        AppAlert.alert(t('error'), t('failed_to_save_route'));
      }
    });
  const remove = () => {
    if (!routeId || !userId) return;
    confirmDelete({
      titleKey: 'delete_route_title',
      messageKey: 'delete_route_message',
      successKey: 'route_deleted_successfully',
      failureKey: 'failed_to_delete_route',
      onLoadingChange: setDeleting,
      onConfirm: async () => {
        await service().delete(userId, routeId);
        navigation.navigate('Routes');
      },
    });
  };
  if (loading) return <ScreenLoading />;
  return (
    <EntityFormContainer
      title={routeId ? t('edit_route') : t('create_route')}
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
      {routeId ? (
        <FormActions stackOnCompact>
          <Button onPress={save} disabled={saving || deleting}>
            {t('save_changes')}
          </Button>
          <Button
            onPress={remove}
            style={{ backgroundColor: colors.error }}
            disabled={saving || deleting}
          >
            {t('delete_route_title')}
          </Button>
        </FormActions>
      ) : (
        <FormActions stackOnCompact>
          <Button onPress={save} disabled={saving || deleting}>
            {t('create_route')}
          </Button>
        </FormActions>
      )}
    </EntityFormContainer>
  );
}
