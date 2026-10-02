import { Ionicons } from '@expo/vector-icons';
import type { StoryPlan } from '@keres/shared';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../theme';
import { getEntityTypeBadge } from '../../../../utils/entityTypeBadge';
import { planUsageLevel } from '../../../../utils/planUsage';

type SortKey = 'name' | 'count';
type SortDirection = 'asc' | 'desc';

/** What a first tap on a header means: names read A to Z, quantities from the biggest. */
const DEFAULT_DIRECTION: Record<SortKey, SortDirection> = { name: 'asc', count: 'desc' };

interface EntityCountCardProps {
  /** The sum of `byType`: what the plan's entity ceiling sees for this story. */
  total: number;
  byType: Partial<Record<string, number>>;
  labelFor: (entityType: string) => string;
  /** The plan the story counts against, when it is on a server that said; `null` shows no plan at all. */
  plan: StoryPlan | null;
  /** Whether the story is linked to a server at all (its plan may still be unreachable). */
  onServer: boolean;
  /**
   * `relations` is the second card: the links and values no plan counts, shown for information. It has no
   * plan and no usage bars, and its own title and explanation.
   */
  variant?: 'counted' | 'relations';
}

/**
 * How many entities the story has, by type, and - when the story is on a server - against what its
 * owner's plan allows. Information only: nothing here blocks anything, the server is what enforces.
 */
const EntityCountCard = ({
  total,
  byType,
  labelFor,
  plan,
  onServer,
  variant = 'counted',
}: EntityCountCardProps) => {
  const { t } = useTranslation();
  const isRelations = variant === 'relations';
  // Both cards can be on one screen: their test ids must not collide.
  const prefix = isRelations ? 'entity-count-relations' : 'entity-count';
  const { colors } = useTheme();
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'count',
    direction: 'desc',
  });

  const rows = useMemo(() => {
    const entries = Object.entries(byType).map(([entityType, value]) => ({
      entityType,
      value: value ?? 0,
      label: labelFor(entityType),
    }));
    const sign = sort.direction === 'asc' ? 1 : -1;
    return entries.sort((a, b) => {
      const byName = a.label.localeCompare(b.label);
      return sort.key === 'name' ? sign * byName : sign * (a.value - b.value) || byName;
    });
  }, [byType, labelFor, sort]);
  const largest = Math.max(1, ...rows.map((row) => row.value));

  const pressHeader = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: DEFAULT_DIRECTION[key] },
    );

  // The same marks as the editor's indicator: warning colour from 90%, alert colour from 95%.
  const usageColor = (used: number, limit: number) => {
    const level = planUsageLevel(used, limit);
    return level === 'alert' ? colors.error : level === 'warning' ? colors.accent : colors.primary;
  };

  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      padding: 15,
      marginBottom: 14,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    titleIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryContainer,
    },
    title: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '700' },
    totalNumber: { color: colors.primary, fontSize: 26, fontWeight: '800' },
    hint: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 10 },
    plan: {
      marginTop: 12,
      padding: 12,
      borderRadius: 8,
      backgroundColor: colors.surface,
      gap: 10,
    },
    planTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
    usageHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    usageLabel: { color: colors.textSecondary, fontSize: 13, flex: 1 },
    usageValue: { color: colors.text, fontSize: 13, fontWeight: '700' },
    track: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 3 },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 14,
      paddingBottom: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
    headerText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.6,
    },
    headerTextActive: { color: colors.primary },
    row: { paddingVertical: 7 },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    rowIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowLabel: { flex: 1, color: colors.text, fontSize: 14 },
    rowValue: { color: colors.text, fontSize: 15, fontWeight: '700' },
    rowTrack: {
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginTop: 6,
      overflow: 'hidden',
    },
    empty: { color: colors.textSecondary, fontSize: 14, paddingVertical: 14, textAlign: 'center' },
  });

  const usage = (label: string, used: number, limit: number | null, testID: string) => (
    <View testID={testID}>
      <View style={styles.usageHead}>
        <Text style={styles.usageLabel}>{label}</Text>
        <Text style={styles.usageValue}>
          {limit === null ? `${used} · ${t('entity_count_unlimited')}` : `${used} / ${limit}`}
        </Text>
      </View>
      {limit !== null && (
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              {
                width: `${Math.min(100, (used / Math.max(1, limit)) * 100)}%`,
                backgroundColor: usageColor(used, limit),
              },
            ]}
          />
        </View>
      )}
    </View>
  );

  const header = (key: SortKey, label: string) => {
    const active = sort.key === key;
    return (
      <TouchableOpacity
        onPress={() => pressHeader(key)}
        style={styles.headerButton}
        accessibilityRole="button"
        testID={`${prefix}-sort-${key}`}
      >
        <Text style={[styles.headerText, active && styles.headerTextActive]}>{label}</Text>
        {active && (
          <Ionicons
            name={sort.direction === 'asc' ? 'arrow-up' : 'arrow-down'}
            size={14}
            color={colors.primary}
            testID={`${prefix}-sort-${key}-${sort.direction}`}
          />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.card} testID={`${prefix}-card`}>
      <View style={styles.titleRow}>
        <View style={styles.titleIcon}>
          <Ionicons
            name={isRelations ? 'git-network-outline' : 'layers-outline'}
            size={20}
            color={colors.onPrimaryContainer}
          />
        </View>
        <Text style={styles.title}>
          {t(isRelations ? 'entity_count_relations_title' : 'entity_count_title')}
        </Text>
        <Text style={styles.totalNumber} testID={`${prefix}-total`}>
          {total}
        </Text>
      </View>

      {plan && !isRelations && (
        <View style={styles.plan} testID="entity-count-plan">
          <Text style={styles.planTitle}>
            {plan.tierName
              ? t('entity_count_plan_named', { name: plan.tierName })
              : t('entity_count_plan')}
          </Text>
          {usage(
            t('entity_count_plan_story'),
            total,
            plan.maxEntitiesPerStory,
            'entity-count-plan-story',
          )}
          {plan.maxEntitiesTotal !== null &&
            usage(
              t('entity_count_plan_total'),
              plan.entitiesUsedTotal,
              plan.maxEntitiesTotal,
              'entity-count-plan-total',
            )}
        </View>
      )}

      <Text style={styles.hint}>
        {isRelations
          ? t('entity_count_relations_hint')
          : onServer
            ? t('entity_count_hint')
            : t('entity_count_hint_local')}
      </Text>

      {rows.length === 0 ? (
        <Text style={styles.empty}>
          {t(isRelations ? 'entity_count_relations_empty' : 'entity_count_empty')}
        </Text>
      ) : (
        <>
          <View style={styles.headerRow}>
            {header('name', t('entity_count_sort_name'))}
            {header('count', t('entity_count_sort_count'))}
          </View>
          {rows.map((row) => {
            const badge = getEntityTypeBadge(row.entityType, colors.secondary);
            return (
              <View key={row.entityType} style={styles.row} testID={`${prefix}-${row.entityType}`}>
                <View style={styles.rowTop}>
                  <View style={[styles.rowIcon, { backgroundColor: `${badge.color}22` }]}>
                    <Ionicons name={badge.icon} size={16} color={badge.color} />
                  </View>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <Text style={styles.rowValue}>{row.value}</Text>
                </View>
                <View style={styles.rowTrack}>
                  <View
                    style={[
                      styles.fill,
                      { width: `${(row.value / largest) * 100}%`, backgroundColor: badge.color },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </>
      )}
    </View>
  );
};

export default EntityCountCard;
