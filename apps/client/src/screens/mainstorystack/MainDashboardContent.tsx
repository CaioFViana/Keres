import DetailField from '@/src/components/common/display/DetailField/DetailField';
import SummaryCard from '@/src/components/common/display/SummaryCard/SummaryCard';
import OperationLogList from '@/src/components/features/operation-log/OperationLogList/OperationLogList';
import SyncConflictBanner from '@/src/components/features/sync/SyncConflictBanner/SyncConflictBanner';
import SyncConflictReviewSheet from '@/src/components/features/sync/SyncConflictReviewSheet/SyncConflictReviewSheet';
import DetailContainer from '@/src/components/layout/DetailContainer/DetailContainer';
import ScreenSection from '@/src/components/layout/ScreenSection/ScreenSection';
import { themeDisplayOptions } from '@keres/shared';
import type { Story } from '@keres/shared/entities/Story';
import type { TFunction } from 'i18next';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme';
import { getLanguageOptions } from '../../utils/i18n';

export type MainDashboardContentProps = {
  story: Story | null | undefined;
  t: TFunction;
  conflictCount: number;
  conflictSheetOpen: boolean;
  onOpenConflictSheet: () => void;
  onCloseConflictSheet: () => void;
  characterCount: number | undefined;
  locationCount: number | undefined;
  chapterCount: number | undefined;
  sceneCount: number | undefined;
  choiceCount: number | undefined;
  noteCount: number | undefined;
  worldRuleCount: number | undefined;
  itemCount: number | undefined;
  galleryCount: number | undefined;
  tagCount: number | undefined;
  customAttributeCount: number | undefined;
  forkCount: number | undefined;
  analysisIssueCount: number | undefined;
  onOpenAnalysis: () => void;
  onOpenOperationLog: () => void;
};

function themeLabelKey(themeName: string | null | undefined): string {
  return (
    themeDisplayOptions.find((option) => option.value === (themeName || 'default'))?.labelKey ??
    'theme_default_label'
  );
}

function languageLabel(t: TFunction, language: string | null | undefined): string | null {
  if (!language) return null;
  return getLanguageOptions(t).find((option) => option.value === language)?.label ?? language;
}

/**
 * Story home: identity first (Detail-style fields), then inventory/health, then a short
 * activity preview — so operation logs no longer own the fold.
 */
export function MainDashboardContent({
  story,
  t,
  conflictCount,
  conflictSheetOpen,
  onOpenConflictSheet,
  onCloseConflictSheet,
  characterCount,
  locationCount,
  chapterCount,
  sceneCount,
  choiceCount,
  noteCount,
  worldRuleCount,
  itemCount,
  galleryCount,
  tagCount,
  customAttributeCount,
  forkCount,
  analysisIssueCount,
  onOpenAnalysis,
  onOpenOperationLog,
}: MainDashboardContentProps) {
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    sectionLink: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '600',
    },
  });

  const typeLabel = story?.type === 'branching' ? t('branching') : t('linear');
  const resolvedLanguage = languageLabel(t, story?.language);

  return (
    <DetailContainer title={story?.title || t('no_story_selected')} width="reading">
      {!!story?.id && (
        <SyncConflictBanner count={conflictCount} onPress={onOpenConflictSheet} />
      )}

      {!!story && (
        <ScreenSection title={t('story_details_section')}>
          <DetailField label={t('type')} value={typeLabel} />
          {!!story.genre?.trim() && <DetailField label={t('genre')} value={story.genre.trim()} />}
          {!!story.author?.trim() && (
            <DetailField label={t('author')} value={story.author.trim()} />
          )}
          {!!resolvedLanguage && <DetailField label={t('language')} value={resolvedLanguage} />}
          <DetailField label={t('theme')} value={t(themeLabelKey(story.theme))} />
          {!!story.description?.trim() && (
            <DetailField label={t('description')} value={story.description.trim()} />
          )}
          {!!story.extraNotes?.trim() && (
            <DetailField label={t('extra_notes')} value={story.extraNotes.trim()} />
          )}
          {!!story.serverId && (
            <DetailField
              label={t('last_server_synced_log')}
              value={String(story.lastServerSyncedLog || 0)}
            />
          )}
        </ScreenSection>
      )}

      <SummaryCard
        title={t('story_overview')}
        characterCount={characterCount}
        locationCount={locationCount}
        chapterCount={chapterCount}
        sceneCount={sceneCount}
        choiceCount={choiceCount}
        noteCount={noteCount}
        worldRuleCount={worldRuleCount}
        itemCount={itemCount}
        galleryCount={galleryCount}
        tagCount={tagCount}
        customAttributeCount={customAttributeCount}
        isBranchingStory={story?.type === 'branching'}
        branchingStoryForkCount={forkCount}
        analysisSummary={
          story?.id && analysisIssueCount !== undefined
            ? {
                issueCount: analysisIssueCount,
                onPress: onOpenAnalysis,
              }
            : undefined
        }
      />

      {!!story?.id && (
        <ScreenSection
          title={t('recent_operations')}
          actions={
            <TouchableOpacity
              onPress={onOpenOperationLog}
              accessibilityRole="button"
              accessibilityLabel={t('view_all_operations')}
            >
              <Text style={styles.sectionLink}>{t('view_all_operations')}</Text>
            </TouchableOpacity>
          }
        >
          <OperationLogList storyId={story.id} limit={5} />
        </ScreenSection>
      )}

      <SyncConflictReviewSheet visible={conflictSheetOpen} onClose={onCloseConflictSheet} />
    </DetailContainer>
  );
}
