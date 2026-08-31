import Button from '@/src/components/common/controls/Button/Button';
import DetailField from '@/src/components/common/display/DetailField/DetailField';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useNavigateToEntityDetail } from '../../hooks/useNavigateToEntityDetail';
import { useStoryRole } from '../../hooks/useStoryRole';
import { useStoryRoutes } from '../../hooks/useStoryRoutes';
import type { PlotsStackParamList } from '../../navigation/MainSystemStack';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { commonDetailStyleDefs, getCommonContainerStyles } from '../../theme/commonStyles';
import { setDocumentTitle } from '../../utils/documentTitle';

type Navigation = NativeStackNavigationProp<PlotsStackParamList, 'RouteDetail'>;
type ScreenRoute = RouteProp<PlotsStackParamList, 'RouteDetail'>;

export default function RouteDetailScreen() {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<Navigation>();
  const { routeId } = useRoute<ScreenRoute>().params;
  const { selectedStory } = useStoryStore();
  const { routes, stepsOf, sceneById, validationOf, loading } = useStoryRoutes(selectedStory?.id);
  const route = routes.find((entry) => entry.id === routeId);
  const { canEdit } = useStoryRole(selectedStory?.id);
  const navigateToDetail = useNavigateToEntityDetail();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        ...commonDetailStyleDefs(colors),
        step: {
          padding: 14,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          marginTop: 10,
        },
        stepName: { color: colors.text, fontWeight: '700' },
        choice: { color: colors.textSecondary, marginTop: 4 },
        count: { color: colors.textSecondary, marginBottom: 14 },
        invalid: { color: colors.error, marginBottom: 12 },
      }),
    [colors],
  );
  const container = getCommonContainerStyles(colors);
  useFocusEffect(
    useCallback(() => {
      const title = route?.name ?? t('route_details_title');
      setDocumentTitle(title);
      navigation.getParent()?.setOptions({
        title,
        headerRight: () =>
          route ? (
            <View style={{ flexDirection: 'row', gap: 16, marginRight: 15 }}>
              <TouchableOpacity
                onPress={() => navigation.navigate('RouteReader', { routeId })}
                accessibilityLabel={t('route_reader')}
              >
                <Ionicons name="book-outline" size={24} color={colors.text} />
              </TouchableOpacity>
              {canEdit ? (
                <TouchableOpacity
                  onPress={() => navigation.navigate('RouteSteps', { routeId })}
                  accessibilityLabel={t('edit_route_steps')}
                >
                  <Ionicons name="list-outline" size={24} color={colors.text} />
                </TouchableOpacity>
              ) : null}
              {canEdit ? (
                <TouchableOpacity
                  onPress={() => navigation.navigate('RouteForm', { routeId })}
                  accessibilityLabel={t('edit_route')}
                >
                  <Ionicons name="pencil-outline" size={24} color={colors.text} />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null,
      });
    }, [canEdit, colors.text, navigation, route, routeId, t]),
  );
  if (loading) return <ScreenLoading padded message={t('loading_routes')} />;
  if (!route)
    return (
      <ScreenError padded message={t('route_not_found')} onGoBack={() => navigation.goBack()} />
    );
  const steps = stepsOf(routeId);
  const issues = validationOf(routeId);
  return (
    <ScrollView style={container.container} contentContainerStyle={{ paddingBottom: 28 }}>
      <Text style={styles.mainTitle}>{route.name}</Text>
      <Text style={styles.count}>{t('route_step_count', { count: steps.length })}</Text>
      {issues.length ? (
        <Text style={styles.invalid}>
          {t('route_invalid_detail', { issues: issues.join(', ') })}
        </Text>
      ) : null}
      <DetailField label={t('route_details')} value={route.details || t('common_na')} />
      <Text style={styles.sectionTitle}>{t('route_steps')}</Text>
      {steps.length ? (
        steps.map((step) => {
          const scene = sceneById(step.sceneId);
          return (
            <TouchableOpacity
              key={step.id}
              style={styles.step}
              onPress={() =>
                navigateToDetail('Scene', step.sceneId, {
                  onReturn: () => navigation.navigate('RouteDetail', { routeId }),
                })
              }
              accessibilityRole="button"
            >
              <Text style={styles.stepName}>
                {step.position}. {scene?.name ?? t('unknown_scene')}
              </Text>
              {step.selectedChoiceId ? (
                <Text style={styles.choice}>{t('route_choice_selected')}</Text>
              ) : (
                <Text style={styles.choice}>{t('route_ends_here')}</Text>
              )}
            </TouchableOpacity>
          );
        })
      ) : (
        <Text style={styles.emptyText}>{t('no_route_steps')}</Text>
      )}
      {canEdit ? (
        <Button
          onPress={() => navigation.navigate('RouteSteps', { routeId })}
          style={{ marginTop: 22 }}
        >
          {t('edit_route_steps')}
        </Button>
      ) : null}
    </ScrollView>
  );
}
