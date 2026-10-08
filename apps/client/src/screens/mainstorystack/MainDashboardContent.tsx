import SummaryCard from '@/src/components/common/display/SummaryCard/SummaryCard';
import UniverseWorksSection from '@/src/components/features/arcs/UniverseWorksSection';
import type { StoryArcSelect } from '@/src/db/schema';
import OperationLogList from '@/src/components/features/operation-log/OperationLogList/OperationLogList';
import SyncConflictBanner from '@/src/components/features/sync/SyncConflictBanner/SyncConflictBanner';
import SyncConflictReviewSheet from '@/src/components/features/sync/SyncConflictReviewSheet/SyncConflictReviewSheet';
import StoryIdentityCard from '@/src/components/features/story/StoryIdentityCard';
import DetailContainer from '@/src/components/layout/DetailContainer/DetailContainer';
import DashboardSection from '@/src/components/layout/DashboardSection/DashboardSection';
import type { Story } from '@keres/shared/entities/Story';
import type { TFunction } from 'i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useScreenAnchor } from '../../guides/useGuideAnchor';
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
  plotCount: number | undefined;
  boardCount: number | undefined;
  forkCount: number | undefined;
  analysisIssueCount: number | undefined;
  onOpenAnalysis: () => void;
  onOpenOperationLog: () => void;
  /** The story's works, when the screen can list and open them. */
  arcs?: readonly StoryArcSelect[];
  onOpenArcs?: () => void;
  /** Opens one work, and starts a new one (only for those who can edit). */
  onOpenArc?: (arcId: string) => void;
  onAddArc?: () => void;
};

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
  plotCount,
  boardCount,
  forkCount,
  analysisIssueCount,
  onOpenAnalysis,
  onOpenOperationLog,
  arcs,
  onOpenArcs,
  onOpenArc,
  onAddArc,
}: MainDashboardContentProps) {
  const { colors } = useTheme();
  const overviewAnchorRef = useScreenAnchor('MainDashboard', 'overview');
  const worksAnchorRef = useScreenAnchor('MainDashboard', 'works');
  const styles = StyleSheet.create({
    sectionLink: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '600',
    },
  });

  const resolvedLanguage = languageLabel(t, story?.language);

  return (
    <DetailContainer title={story?.title || t('no_story_selected')}>
      {!!story?.id && <SyncConflictBanner count={conflictCount} onPress={onOpenConflictSheet} />}

      {!!story && (
        <StoryIdentityCard
          type={story.type === 'branching' ? 'branching' : 'linear'}
          genre={story.genre}
          author={story.author}
          language={resolvedLanguage}
          description={story.description}
          extraNotes={story.extraNotes}
          syncedLog={story.serverId ? story.lastServerSyncedLog : null}
        />
      )}

      {!!story && !!arcs?.length && !!onOpenArcs && (
        <View ref={worksAnchorRef} collapsable={false}>
          <UniverseWorksSection
            arcs={arcs}
            onOpenArcs={onOpenArcs}
            onOpenArc={onOpenArc}
            onAddArc={onAddArc}
          />
        </View>
      )}

      <View ref={overviewAnchorRef} collapsable={false}>
        <SummaryCard
          layout="section"
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
          plotCount={plotCount}
          boardCount={boardCount}
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
      </View>

      {!!story?.id && (
        <DashboardSection
          title={t('recent_operations')}
          action={
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
        </DashboardSection>
      )}

      <SyncConflictReviewSheet visible={conflictSheetOpen} onClose={onCloseConflictSheet} />
    </DetailContainer>
  );
}
