import { Ionicons } from '@expo/vector-icons';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import CollapsibleCard from '@/src/components/common/display/CollapsibleCard/CollapsibleCard';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import type { MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import type {
  StoryAnalysisReport} from '../../services/storymanagement/StoryAnalysisService';
import {
  createStoryAnalysisService
} from '../../services/storymanagement/StoryAnalysisService';
import { createStoryIndexService } from '../../services/storymanagement/StoryIndexService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { commonDetailStyleDefs, getCommonContainerStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';
import { setDocumentTitle } from '../../utils/documentTitle';
import { navigateToEntityDetail } from '../../utils/entityNavigation';
import type {
  StoryAnalysisCategory,
  StoryAnalysisFinding} from '../../utils/storyAnalysisChecks';
import {
  StoryAnalysisCancelledError
} from '../../utils/storyAnalysisChecks';

/**
 * Relatório de análise estrutural: não é busca, é achar o que o escritor dificilmente notaria
 * sozinho (ver `storyAnalysisChecks.ts`). As checagens rápidas recarregam ao focar - a pessoa
 * normalmente chega aqui, corrige um problema, volta e quer ver o relatório atualizado sem
 * precisar recarregar à mão. Alcançabilidade/satisfazibilidade de Choice (as caras, que percorrem
 * o grafo inteiro em rodadas de ponto fixo) só rodam sob demanda pelo botão: rodar isso a cada
 * foco de tela travaria a UI em histórias ramificadas grandes.
 */

type StoryAnalysisNavigationProp = DrawerNavigationProp<MainSystemDrawerParamList, 'StoryAnalysis'>;

const CATEGORY_ORDER: StoryAnalysisCategory[] = [
  'scenes',
  'choices',
  'characters',
  'locations',
  'items',
  'tags',
  'storySchema',
];

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
  useBackButtonHandler({ showWebBackButton: true });
  // Não usa route.params: chegar aqui direto pelo drawer (em vez de vindo do
  // MainDashboard, que passa storyId explicitamente) navega sem nenhum param - a mesma
  // história de selectedStory já corrigida em StorySettingsScreen.
  const { selectedStory } = useStoryStore();
  const { userId } = useUserSettingsStore();
  const storyId = selectedStory?.id;
  const drizzleDb = useDrizzle();
  const commonContainerStyles = getCommonContainerStyles(colors);

  const [report, setReport] = useState<StoryAnalysisReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [normalizing, setNormalizing] = useState(false);
  const [progressFraction, setProgressFraction] = useState(0);
  // Alcançabilidade/satisfazibilidade só valem pra história ramificada - pra história linear, a
  // checagem rápida já é o relatório completo, sem precisar do botão.
  const [hasRunFull, setHasRunFull] = useState(selectedStory?.type !== 'branching');
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadCheapReport = useCallback(async () => {
    if (!storyId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await createStoryAnalysisService(drizzleDb).analyzeStoryCheap(storyId);
      setReport(result);
      setHasRunFull(selectedStory?.type !== 'branching');
    } catch (loadError) {
      console.error('StoryAnalysisScreen: failed to analyze story.', loadError);
      setError(t('failed_to_load_analysis'));
    } finally {
      setLoading(false);
    }
  }, [drizzleDb, storyId, selectedStory?.type, t]);

  useFocusEffect(
    useCallback(() => {
      loadCheapReport();
      // Cancela a análise pesada em andamento ao sair da tela - não faz sentido continuar
      // rodando em background depois que ninguém mais está vendo o progresso.
      return () => abortControllerRef.current?.abort();
    }, [loadCheapReport]),
  );

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ title: t('story_analysis_title') });
      setDocumentTitle(t('story_analysis_title'));
    }, [navigation, t]),
  );

  /**
   * Renumera capítulos e cenas para 1..N. Fica atrás de um toque explícito, e não roda ao
   * abrir a tela: mexe em muitas linhas de uma vez e vira operações de sincronização.
   */
  const normalizeIndexes = useCallback(async () => {
    if (!storyId || !userId || normalizing) return;
    setNormalizing(true);
    try {
      const changed = await createStoryIndexService(drizzleDb).normalizeIndexes(userId, storyId);
      await loadCheapReport();
      AppAlert.alert(t('success'), t('analysis_fix_indexes_done', changed));
    } catch (normalizeError) {
      console.error('StoryAnalysisScreen: failed to normalize indexes.', normalizeError);
      AppAlert.alert(t('error'), t('analysis_fix_indexes_failed'));
    } finally {
      setNormalizing(false);
    }
  }, [drizzleDb, loadCheapReport, normalizing, storyId, t, userId]);

  const hasIndexFindings = useMemo(
    () =>
      (report?.findings ?? []).some((finding) =>
        finding.messageKey.startsWith('analysis_chapter_index_') ||
        finding.messageKey.startsWith('analysis_scene_index_'),
      ),
    [report],
  );

  const runFullAnalysis = useCallback(async () => {
    if (!storyId || analyzing) return;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setAnalyzing(true);
    setProgressFraction(0);
    setError(null);
    try {
      const result = await createStoryAnalysisService(drizzleDb).analyzeStoryFull(storyId, {
        signal: abortController.signal,
        onProgress: ({ fraction }) => setProgressFraction(fraction),
      });
      setReport(result);
      setHasRunFull(true);
    } catch (runError) {
      if (runError instanceof StoryAnalysisCancelledError) {
        setError(t('story_analysis_cancelled'));
      } else {
        console.error('StoryAnalysisScreen: failed to run full analysis.', runError);
        setError(t('failed_to_load_analysis'));
      }
    } finally {
      abortControllerRef.current = null;
      setAnalyzing(false);
    }
  }, [analyzing, drizzleDb, storyId, t]);

  const cancelFullAnalysis = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const findingsByCategory = useMemo(() => {
    const grouped = new Map<StoryAnalysisCategory, StoryAnalysisFinding[]>();
    for (const finding of report?.findings ?? []) {
      if (!grouped.has(finding.category)) grouped.set(finding.category, []);
      grouped.get(finding.category)!.push(finding);
    }
    return grouped;
  }, [report]);

  const handleFindingPress = useCallback(
    (finding: StoryAnalysisFinding) => {
      if (!finding.entityId) return;
      navigateToEntityDetail(navigation, finding.entityType, finding.entityId);
    },
    [navigation],
  );

  const styles = StyleSheet.create({
    ...commonDetailStyleDefs(colors),
    scrollContent: {
      // O container comum já aplica 20px em todos os lados. Repetir o padding no conteúdo
      // rolável deixava o cartão da checagem 40px afastado das bordas, diferente das demais
      // telas do drawer.
      flexGrow: 1,
    },
    subtitle: {
      color: colors.textSecondary,
      marginBottom: 16,
    },
    analysisCard: {
      // Mesmas medidas dos cartões de resultado, para o controle de checagem não parecer
      // uma região com recuo maior que o relatório abaixo.
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      padding: 15,
      marginBottom: 10,
    },
    analysisHint: {
      color: colors.textSecondary,
      fontSize: 13,
      marginBottom: 12,
      lineHeight: 18,
    },
    progressRow: {
      marginBottom: 12,
    },
    progressLabel: {
      color: colors.textSecondary,
      fontSize: 13,
      marginBottom: 6,
    },
    progressTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    cancelButton: {
      backgroundColor: colors.error,
      marginTop: 4,
    },
    fixButton: {
      marginTop: 8,
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
  });

  if (loading) {
    return <ScreenLoading padded message={t('loading_analysis')} />;
  }

  if (error && !report) {
    return <ScreenError padded message={error} onGoBack={() => navigation.goBack()} />;
  }

  const progressPercent = Math.round(progressFraction * 100);

  const analysisCard = (
    <View style={styles.analysisCard}>
      <Text style={styles.analysisHint}>{t('story_analysis_run_hint')}</Text>
      {analyzing && (
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>
            {t('story_analysis_progress', { percent: progressPercent })}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>
      )}
      {!!error && report && (
        <Text style={[styles.analysisHint, { color: colors.error }]}>{error}</Text>
      )}
      {analyzing ? (
        <Button onPress={cancelFullAnalysis} style={styles.cancelButton} testID="cancel-analysis">
          {t('cancel')}
        </Button>
      ) : (
        <Button onPress={runFullAnalysis} disabled={!storyId} testID="run-full-analysis">
          {t('story_analysis_run_button')}
        </Button>
      )}
      {hasIndexFindings && (
        <Button
          onPress={normalizeIndexes}
          disabled={normalizing || analyzing}
          style={styles.fixButton}
          testID="fix-indexes"
        >
          {normalizing ? t('loading') : t('analysis_fix_indexes_button')}
        </Button>
      )}
    </View>
  );

  if (!report || (report.findings.length === 0 && hasRunFull)) {
    return (
      <ScrollView
        style={commonContainerStyles.container}
        contentContainerStyle={styles.scrollContent}
      >
        {analysisCard}
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-circle-outline" size={54} color={colors.primary} />
          <Text style={styles.emptyText}>{t('analysis_no_issues_found')}</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={commonContainerStyles.container}
      contentContainerStyle={styles.scrollContent}
    >
      {analysisCard}

      {(hasRunFull || report.findings.length > 0) && (
        <Text style={styles.subtitle}>
          {t('story_analysis_subtitle', { count: report.findings.length })}
        </Text>
      )}

      {CATEGORY_ORDER.map((category) => {
        const findings = findingsByCategory.get(category);
        if (!findings || findings.length === 0) return null;

        return (
          <CollapsibleCard
            key={category}
            title={`${t(CATEGORY_TITLE_KEYS[category])} (${findings.length})`}
          >
            {findings.map((finding) => (
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
                  {!!finding.entityName && (
                    <Text style={styles.findingEntityName}>{finding.entityName}</Text>
                  )}
                  <Text style={styles.findingMessage}>
                    {t(finding.messageKey, finding.messageParams)}
                  </Text>
                </View>
                {!!finding.entityId && (
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            ))}
          </CollapsibleCard>
        );
      })}
    </ScrollView>
  );
};

export default StoryAnalysisScreen;
