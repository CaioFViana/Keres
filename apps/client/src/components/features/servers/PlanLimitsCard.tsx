import type { AccountPlan } from '@keres/shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import { planLimitLines } from '@/src/utils/billing/planLimitLines';
import { serverCardStyleDefs } from './serverCardStyleDefs';

export interface PlanLimitsCardProps {
  plan: AccountPlan;
}

/**
 * What the plan a person has comes with: its name, its ceilings in words, and how much of the stories and of
 * the total entities they use. Shown for any plan - the free one every account starts on included - so the
 * person need not open a story, or look elsewhere, to learn what they have.
 */
const PlanLimitsCard: React.FC<PlanLimitsCardProps> = ({ plan }) => {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);

  const usage: string[] = [];
  if (plan.maxStories !== null) {
    usage.push(t('plan_card_stories_used', { used: plan.storiesUsed, limit: plan.maxStories }));
  }
  if (plan.maxEntitiesTotal !== null) {
    usage.push(
      t('plan_card_entities_used', { used: plan.entitiesUsedTotal, limit: plan.maxEntitiesTotal }),
    );
  }
  const lines = [...planLimitLines(plan, t), ...usage];

  return (
    <View style={styles.card} testID="plan-limits-card">
      <View style={[styles.row, styles.lastRow]}>
        <Text style={styles.label}>{t('payment_plan_field')}</Text>
        <Text style={styles.value} selectable>
          {plan.tierName ?? t('plan_card_no_plan')}
        </Text>
      </View>
      {plan.isDefault ? <Text style={styles.hint}>{t('plan_card_default_hint')}</Text> : null}
      <View style={styles.lines}>
        {lines.map((text) => (
          <Text key={text} style={styles.line}>
            {text}
          </Text>
        ))}
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    ...serverCardStyleDefs(colors),
    hint: { fontSize: 13, color: colors.textSecondary, paddingBottom: 8 },
    lines: {
      gap: 6,
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    line: { fontSize: 14, color: colors.text },
  });

export default PlanLimitsCard;
