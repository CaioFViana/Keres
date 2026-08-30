import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useNavigateToEntityDetail } from '../../hooks/useNavigateToEntityDetail';
import { useStoryRoutes } from '../../hooks/useStoryRoutes';
import type { PlotsStackParamList } from '../../navigation/MainSystemStack';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { commonScreenStyleDefs } from '../../theme/commonStyles';
import { setDocumentTitle } from '../../utils/documentTitle';

type Navigation = NativeStackNavigationProp<PlotsStackParamList, 'RouteReader'>;
type ScreenRoute = RouteProp<PlotsStackParamList, 'RouteReader'>;

export default function RouteReaderScreen() {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<Navigation>();
  const { routeId } = useRoute<ScreenRoute>().params;
  const { selectedStory } = useStoryStore();
  const navigate = useNavigateToEntityDetail();
  const { routes, stepsOf, sceneById, loading } = useStoryRoutes(selectedStory?.id);
  const route = routes.find((entry) => entry.id === routeId);
  const steps = stepsOf(routeId);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        ...commonScreenStyleDefs(colors),
        header: { padding: 20, paddingBottom: 6 },
        title: { color: colors.text, fontSize: 22, fontWeight: '700' },
        subtitle: { color: colors.textSecondary, marginTop: 5 },
        content: { paddingHorizontal: 20, paddingBottom: 28 },
        entry: { paddingVertical: 18 },
        divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
        sceneTitle: {
          color: colors.textSecondary,
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          marginBottom: 8,
        },
        summary: { color: colors.text, fontSize: 16, lineHeight: 26 },
        missing: { color: colors.textSecondary, fontSize: 16, fontStyle: 'italic' },
      }),
    [colors],
  );
  useFocusEffect(
    useCallback(() => {
      const title = route ? t('route_reader_title', { route: route.name }) : t('route_reader');
      setDocumentTitle(title);
      navigation.getParent()?.setOptions({ title, headerRight: undefined });
    }, [navigation, route, t]),
  );
  if (loading) return <ScreenLoading message={t('loading_routes')} />;
  if (!route)
    return <ScreenError message={t('route_not_found')} onGoBack={() => navigation.goBack()} />;
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{route.name}</Text>
        <Text style={styles.subtitle}>{t('route_reader_scope', { count: steps.length })}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {steps.map((step, index) => {
          const scene = sceneById(step.sceneId);
          return (
            <View key={step.id}>
              {index ? <View style={styles.divider} /> : null}
              <View style={styles.entry}>
                <TouchableOpacity
                  onPress={() =>
                    navigate('Scene', step.sceneId, {
                      onReturn: () => navigation.navigate('RouteReader', { routeId }),
                    })
                  }
                >
                  <Text
                    style={styles.sceneTitle}
                  >{`${index + 1}. ${scene?.name ?? t('unknown_scene')}`}</Text>
                </TouchableOpacity>
                <Text style={scene?.summary ? styles.summary : styles.missing}>
                  {scene?.summary || t('plot_reader_no_summary')}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
