import React from 'react';
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import ScreenTitle from '@/src/components/layout/ScreenTitle/ScreenTitle';
import {
  screenLayoutStyles,
  type ContentWidth,
} from '@/src/components/layout/ScreenContainer/ScreenContainer';
import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import PlanUsageBanner from '@/src/components/common/feedback/PlanUsageBanner/PlanUsageBanner';
import { useScreenTour } from '@/src/guides/useScreenTour';
import { useTheme } from '@/src/theme';
import GuideAnchor from '@/src/guides/GuideAnchor';

interface EntityFormContainerProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  width?: ContentWidth;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
  /**
   * Whether the form shows how close the open story is to its plan. On by default - these are the forms that
   * create the entities a plan counts; off for the ones that are not about the open story's content.
   */
  planUsage?: boolean;
}

/** Entity editing layout; validation, operations and permissions belong to the caller. */
export default function EntityFormContainer({
  children,
  title,
  description,
  actions,
  width = 'full',
  style,
  contentContainerStyle,
  keyboardVerticalOffset,
  planUsage = true,
}: EntityFormContainerProps) {
  const { colors } = useTheme();
  // The first entity form opened explains the form for all of them; the forms that are not about the
  // story's content (`planUsage` off) are not part of it.
  useScreenTour('EntityForm', planUsage);
  return (
    <KeyboardAwareScreen
      style={[{ backgroundColor: colors.background }, style]}
      contentContainerStyle={[
        screenLayoutStyles.content,
        styles.content,
        width === 'reading' && screenLayoutStyles.reading,
        contentContainerStyle,
      ]}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {title !== undefined && <ScreenTitle>{title}</ScreenTitle>}
      {description !== undefined && (
        <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
      )}
      {planUsage && <PlanUsageBanner />}
      <GuideAnchor screen="EntityForm" part="fields">
        {children}
      </GuideAnchor>
      {actions && (
        <GuideAnchor screen="EntityForm" part="actions">
          <FormActions stackOnCompact>{actions}</FormActions>
        </GuideAnchor>
      )}
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  description: { marginBottom: 20 },
});
