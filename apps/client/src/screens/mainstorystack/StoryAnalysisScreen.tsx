import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CollapsibleCard from '../../components/common/CollapsibleCard/CollapsibleCard';
import { ScreenError, ScreenLoading } from '../../components/common/ScreenState/ScreenState';
import { useDrizzle } from '../../db';
import { MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { createStoryAnalysisService, StoryAnalysisReport } from '../../services/storymanagement/StoryAnalysisService';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { navigateToEntityDetail } from '../../utils/entityNavigation';
import { StoryAnalysisCategory, StoryAnalysisFinding } from '../../utils/storyAnalysisChecks';

/**
 * Relatório de análise estrutural: não é busca, é achar o que o escritor dificilmente notaria
 * sozinho (ver `storyAnalysisChecks.ts`). Recarrega ao focar - a pessoa normalmente chega aqui,
 * corrige um problema, volta e quer ver o relatório atualizado sem precisar recarregar à mão.
 */

type StoryAnalysisNavigationProp = DrawerNavigationProp<MainSystemDrawerParamList, 'StoryAnalysis'>;

const CATEGORY_ORDER: StoryAnalysisCategory[] = ['scenes', 'choices', 'characters', 'locations', 'items', 'tags', 'storySchema'];

const CATEGORY_TITLE_KEYS: Record<StoryAnalysisCategory, string> = {
  scenes: 'analysis_category_scenes',
  choices: 'analysis_category_choices',
  characters: 'analysis_category_characters',
  locations: 'analysis_category_locations',
  items: 'analysis_category_items',
  tags: 'analysis_category_tags',
  storySchema: 'analysis_category_story_schema',
};

const StoryAnalysisScreen = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<StoryAnalysisNavigationProp>();
  // Não usa route.params: chegar aqui direto pelo drawer (em vez de vindo do
  // MainDashboard, que passa storyId explicitamente) navega sem nenhum param - a mesma
  // história de selectedStory já corrigida em StorySettingsScreen.
  const { selectedStory } = useStoryStore();
  const storyId = selectedStory?.id;
  const drizzleDb = useDrizzle();
  const commonContainerStyles = getCommonContainerStyles(colors);

  const [report, setReport] = useState<StoryAnalysisReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    if (!storyId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await createStoryAnalysisService(drizzleDb).analyzeStory(storyId);
      setReport(result);
    } catch (loadError) {
      console.error('StoryAnalysisScreen: failed to analyze story.', loadError);
      setError(t('failed_to_load_analysis'));
    } finally {
      setLoading(false);
    }
  }, [drizzleDb, storyId, t]);

  useFocusEffect(useCallback(() => {
    loadReport();
  }, [loadReport]));

  useFocusEffect(useCallback(() => {
    navigation.setOptions({ title: t('story_analysis_title') });
  }, [navigation, t]));

  const findingsByCategory = useMemo(() => {
    const grouped = new Map<StoryAnalysisCategory, StoryAnalysisFinding[]>();
    for (const finding of report?.findings ?? []) {
      if (!grouped.has(finding.category)) grouped.set(finding.category, []);
      grouped.get(finding.category)!.push(finding);
    }
    return grouped;
  }, [report]);

  const handleFindingPress = useCallback((finding: StoryAnalysisFinding) => {
    if (!finding.entityId) return;
    navigateToEntityDetail(navigation, finding.entityType, finding.entityId);
  }, [navigation]);

  const styles = StyleSheet.create({
    scrollContent: {
      padding: 20,
    },
    subtitle: {
      color: colors.textSecondary,
      marginBottom: 16,
    },
    findingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
    },
    findingTextGroup: {
      flex: 1,
      marginLeft: 10,
    },
    findingEntityName: {
      fontSize: 15,
      fontWeight: 'bold',
      color: colors.text,
    },
    findingMessage: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    emptyText: {
      marginTop: 12,
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
    },
  });

  if (loading) {
    return <ScreenLoading padded message={t('loading_analysis')} />;
  }

  if (error) {
    return <ScreenError padded message={error} onGoBack={() => navigation.goBack()} />;
  }

  if (!report || report.findings.length === 0) {
    return (
      <View style={commonContainerStyles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-circle-outline" size={54} color={colors.primary} />
          <Text style={styles.emptyText}>{t('analysis_no_issues_found')}</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={commonContainerStyles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.subtitle}>{t('story_analysis_subtitle', { count: report.findings.length })}</Text>

      {CATEGORY_ORDER.map(category => {
        const findings = findingsByCategory.get(category);
        if (!findings || findings.length === 0) return null;

        return (
          <CollapsibleCard key={category} title={`${t(CATEGORY_TITLE_KEYS[category])} (${findings.length})`}>
            {findings.map(finding => (
              <TouchableOpacity
                key={finding.id}
                style={styles.findingRow}
                onPress={() => handleFindingPress(finding)}
                disabled={!finding.entityId}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={finding.severity === 'error' ? 'alert-circle-outline' : 'warning-outline'}
                  size={22}
                  color={finding.severity === 'error' ? colors.error : colors.text}
                />
                <View style={styles.findingTextGroup}>
                  {!!finding.entityName && <Text style={styles.findingEntityName}>{finding.entityName}</Text>}
                  <Text style={styles.findingMessage}>{t(finding.messageKey, finding.messageParams)}</Text>
                </View>
                {!!finding.entityId && <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />}
              </TouchableOpacity>
            ))}
          </CollapsibleCard>
        );
      })}
    </ScrollView>
  );
};

export default StoryAnalysisScreen;
