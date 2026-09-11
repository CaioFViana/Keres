import ScreenSection from '@/src/components/layout/ScreenSection/ScreenSection';
import DetailContainer from '@/src/components/layout/DetailContainer/DetailContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import Button from '@/src/components/common/controls/Button/Button';
import DetailField from '@/src/components/common/display/DetailField/DetailField';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useNavigateToEntityDetail } from '../../hooks/useNavigateToEntityDetail';
import { useStoryRole } from '../../hooks/useStoryRole';
import { useStoryRoutes } from '../../hooks/useStoryRoutes';
import type { PlotsStackParamList } from '../../navigation/MainSystemStack';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { commonDetailStyleDefs } from '../../theme/commonStyles';

type Navigation = NativeStackNavigationProp<PlotsStackParamList, 'RouteDetail'>;
type ScreenRoute = RouteProp<PlotsStackParamList, 'RouteDetail'>;

export default function RouteDetailScreen() {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<Navigation>();
  const { routeId } = useRoute<ScreenRoute>().params;
  const { selectedStory } = useStoryStore();
  const { routes, stepsOf, sceneById, validationOf, executionValidationOf, loading } =
    useStoryRoutes(selectedStory?.id);
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
  useScreenHeader({
    target: 'parent',
    title: route?.name ?? t('route_details_title'),
    actions: [
      {
        id: 'action-0',
        icon: 'book-outline',
        label: t('route_reader'),
        onPress: () => navigation.navigate('RouteReader', { routeId }),
        visible: !!route,
      },
      {
        id: 'action-1',
        icon: 'git-branch-outline',
        label: t('route_timeline'),
        onPress: () => navigation.navigate('RouteTimeline', { routeId }),
        visible: !!route,
      },
      {
        id: 'action-2',
        icon: 'list-outline',
        label: t('edit_route_steps'),
        onPress: () => navigation.navigate('RouteSteps', { routeId }),
        visible: !!(route && canEdit),
      },
      {
        id: 'action-3',
        icon: 'pencil-outline',
        label: t('edit_route'),
        onPress: () => navigation.navigate('RouteForm', { routeId }),
        visible: !!(route && canEdit),
      },
    ],
  });
  if (loading) return <ScreenLoading padded message={t('loading_routes')} />;
  if (!route)
    return (
      <ScreenError padded message={t('route_not_found')} onGoBack={() => navigation.goBack()} />
    );
  const steps = stepsOf(routeId);
  const issues = validationOf(routeId);
  const execution = executionValidationOf(routeId);
  const unavailableIssue = execution.issues.find((issue) => issue.kind === 'choice_unavailable');
  return (
    <DetailContainer title={route.name}>
      <Text style={styles.count}>{t('route_step_count', { count: steps.length })}</Text>
      {issues.length ? (
        <Text style={styles.invalid}>
          {t('route_invalid_detail', { issues: issues.join(', ') })}
        </Text>
      ) : null}
      {unavailableIssue ? (
        <Text style={styles.invalid}>
          {t('route_choice_no_longer_available', {
            step: steps.find((step) => step.id === unavailableIssue.stepId)?.position ?? '?',
          })}
        </Text>
      ) : null}
      <DetailField label={t('route_details')} value={route.details || t('common_na')} />
      <ScreenSection title={t('route_steps')} />
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
      <Button
        onPress={() => navigation.navigate('RouteTimeline', { routeId })}
        style={{ marginTop: 12 }}
      >
        {t('route_timeline')}
      </Button>
    </DetailContainer>
  );
}
