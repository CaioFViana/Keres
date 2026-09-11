import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { useNavigation } from '@react-navigation/native';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  ScreenError,
  ScreenLoading,
} from '../../components/common/feedback/ScreenState/ScreenState';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useStoryRole } from '../../hooks/useStoryRole';
import { useStoryRoutes } from '../../hooks/useStoryRoutes';
import type { PlotsStackParamList } from '../../navigation/MainSystemStack';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { commonScreenStyleDefs } from '../../theme/commonStyles';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Navigation = NativeStackNavigationProp<PlotsStackParamList, 'Routes'>;

export default function RouteListScreen() {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<Navigation>();
  const { selectedStory } = useStoryStore();
  const { routes, stepsOf, loading } = useStoryRoutes(selectedStory?.id);
  const { canEdit } = useStoryRole(selectedStory?.id);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        ...commonScreenStyleDefs(colors),
        row: {
          padding: 16,
          marginHorizontal: 15,
          marginTop: 12,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          backgroundColor: colors.surface,
        },
        name: { color: colors.text, fontSize: 17, fontWeight: '700' },
        meta: { color: colors.textSecondary, marginTop: 5 },
        empty: {
          color: colors.textSecondary,
          textAlign: 'center',
          marginTop: 36,
          paddingHorizontal: 24,
        },
      }),
    [colors],
  );

  useScreenHeader({
    target: 'parent',
    title: t('routes_title'),
    actions: [
      {
        id: 'action-0',
        icon: 'add',
        label: t('create_route'),
        onPress: () => navigation.navigate('RouteForm', {}),
        visible: !!canEdit,
      },
    ],
  });

  if (!selectedStory?.id)
    return <ScreenError message={t('no_story_selected')} onGoBack={() => navigation.goBack()} />;
  if (selectedStory.type !== 'branching')
    return (
      <ScreenError message={t('routes_branching_only')} onGoBack={() => navigation.goBack()} />
    );
  if (loading) return <ScreenLoading message={t('loading_routes')} />;
  return (
    <View style={styles.container}>
      <FlatList
        data={routes}
        keyExtractor={(route) => route.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('RouteDetail', { routeId: item.id })}
            accessibilityRole="button"
            accessibilityLabel={item.name}
          >
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>
              {t('route_step_count', { count: stepsOf(item.id).length })}
            </Text>
            {item.details ? (
              <Text style={styles.meta} numberOfLines={2}>
                {item.details}
              </Text>
            ) : null}
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{t('no_routes')}</Text>}
      />
    </View>
  );
}
