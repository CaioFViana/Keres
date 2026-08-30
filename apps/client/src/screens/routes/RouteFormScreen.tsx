import Button from '@/src/components/common/controls/Button/Button';
import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import type { PlotsStackParamList } from '../../navigation/MainSystemStack';
import { createRouteService } from '../../services/storymanagement/RouteService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { commonFormStyleDefs, getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';
import { setDocumentTitle } from '../../utils/documentTitle';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Navigation = NativeStackNavigationProp<PlotsStackParamList, 'RouteForm'>;
type FormRoute = RouteProp<PlotsStackParamList, 'RouteForm'>;

export default function RouteFormScreen() {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation(); const { colors } = useTheme(); const db = useDrizzle();
  const navigation = useNavigation<Navigation>(); const screenRoute = useRoute<FormRoute>(); const routeId = screenRoute.params?.routeId;
  const { selectedStory } = useStoryStore(); const { userId } = useUserSettingsStore(); const confirmDelete = useConfirmDelete();
  const [name, setName] = useState(''); const [details, setDetails] = useState(''); const [loading, setLoading] = useState(Boolean(routeId));
  const service = useCallback(() => createRouteService(db), [db]);
  const container = getCommonContainerStyles(colors); const input = getCommonInputStyles(colors);
  const styles = useMemo(() => StyleSheet.create({ ...commonFormStyleDefs(colors), description: { color: colors.textSecondary, marginBottom: 20 } }), [colors]);
  useFocusEffect(useCallback(() => { const title = routeId ? t('edit_route') : t('create_route'); setDocumentTitle(title); navigation.getParent()?.setOptions({ title, headerRight: () => <View /> }); }, [navigation, routeId, t]));
  useEffect(() => { if (!routeId) { setLoading(false); return; } service().getById(routeId).then((route) => { if (route) { setName(route.name); setDetails(route.details ?? ''); } }).finally(() => setLoading(false)); }, [routeId, service]);
  const save = async () => { if (!selectedStory?.id || !userId || !name.trim()) { AppAlert.alert(t('error'), !name.trim() ? t('route_name_required') : t('user_not_identified')); return; } setLoading(true); try { const saved = await service().save(userId, { id: routeId, storyId: selectedStory.id, name, details: details.trim() || null }); if (routeId) navigation.goBack(); else navigation.replace('RouteDetail', { routeId: saved.id }); } catch { AppAlert.alert(t('error'), t('failed_to_save_route')); } finally { setLoading(false); } };
  const remove = () => { if (!routeId || !userId) return; confirmDelete({ titleKey: 'delete_route_title', messageKey: 'delete_route_message', successKey: 'route_deleted_successfully', failureKey: 'failed_to_delete_route', onLoadingChange: setLoading, onConfirm: async () => { await service().delete(userId, routeId); navigation.navigate('Routes'); } }); };
  if (loading) return <View style={[container.container, styles.centered]}><Text style={{ color: colors.text }}>{t('loading')}...</Text></View>;
  return <KeyboardAwareScreen style={container.container} contentContainerStyle={styles.scrollViewContent}>
    <Text style={styles.title}>{routeId ? t('edit_route') : t('create_route')}</Text><Text style={styles.description}>{t('route_form_description')}</Text>
    <Text style={styles.label}>{t('route_name')}</Text><TextInput value={name} onChangeText={setName} placeholder={t('route_name_placeholder')} style={input.input} />
    <Text style={styles.label}>{t('route_details')}</Text><TextInput value={details} onChangeText={setDetails} placeholder={t('route_details_placeholder')} style={[input.input, { minHeight: 100, textAlignVertical: 'top' }]} multiline />
    <FormActions stackOnCompact>{routeId ? <><Button onPress={save}>{t('save_changes')}</Button><Button onPress={remove} style={{ backgroundColor: colors.error }}>{t('delete_route_title')}</Button></> : <Button onPress={save}>{t('create_route')}</Button>}</FormActions>
  </KeyboardAwareScreen>;
}
