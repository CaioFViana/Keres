import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import DashboardSection from '@/src/components/layout/DashboardSection/DashboardSection';
import type { ResumeScene } from '@/src/hooks/useResumeScene';
import { useTheme } from '@/src/theme';
import { formatEditedAgo } from '@/src/utils/editedAgo';

interface StoryWritingSectionProps {
  /** The scene last written in; absent while the story has none. */
  resume: ResumeScene | null;
  chapterCount?: number;
  sceneCount?: number;
  /** A reader sees the story, not the doors to add to it. */
  canEdit: boolean;
  onContinue: (sceneId: string) => void;
  onNewScene: () => void;
  onNewCharacter: () => void;
  onNewNote: () => void;
  onOpenManuscript: () => void;
  onExportManuscript: () => void;
  /** Absent where the story cannot be published: a reader, or a build with no server. */
  onPublishManuscript?: () => void;
  /** Where the tour points; the section is one block. */
  anchorRef?: React.Ref<View>;
  now?: Date;
}

/**
 * The part of the story's home for writing: pick up the scene last worked on, start something new, and the
 * manuscript the scenes add up to - read it or take it out of the app. Everything here opens a place that
 * already exists; the section only shortens the way there.
 */
const StoryWritingSection: React.FC<StoryWritingSectionProps> = ({
  resume,
  chapterCount,
  sceneCount,
  canEdit,
  onContinue,
  onNewScene,
  onNewCharacter,
  onNewNote,
  onOpenManuscript,
  onExportManuscript,
  onPublishManuscript,
  anchorRef,
  now,
}) => {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      padding: 14,
    },
    row: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    body: { flexGrow: 1, flexShrink: 1, minWidth: 160 },
    title: { color: colors.text, fontSize: 16, fontWeight: '700' },
    detail: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    chip: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    chipLabel: { color: colors.text, fontSize: 13 },
    manuscript: { marginTop: 10 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  });

  const hasManuscript = (sceneCount ?? 0) > 0;
  // Chapters are left out when there are none: a story can be all loose scenes.
  const manuscriptDetail = [
    sceneCount === undefined ? null : t('story_writing_scenes', { count: sceneCount }),
    chapterCount ? t('story_writing_chapters', { count: chapterCount }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const chips: {
    id: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
  }[] = canEdit
    ? [
        {
          id: 'scene',
          icon: 'add-circle-outline',
          label: t('story_writing_new_scene'),
          onPress: onNewScene,
        },
        {
          id: 'character',
          icon: 'person-add-outline',
          label: t('story_writing_new_character'),
          onPress: onNewCharacter,
        },
        {
          id: 'note',
          icon: 'document-text-outline',
          label: t('story_writing_new_note'),
          onPress: onNewNote,
        },
      ]
    : [];

  return (
    <View ref={anchorRef} collapsable={false}>
      <DashboardSection title={t('story_writing_title')}>
        {resume ? (
          <View style={styles.card} testID="story-writing-resume">
            <Text style={styles.detail}>{t('story_writing_resume_label')}</Text>
            <View style={styles.row}>
              <View style={styles.body}>
                <Text style={styles.title} numberOfLines={2}>
                  {resume.name}
                </Text>
                <Text style={styles.detail}>
                  {[
                    resume.chapterName,
                    t('story_writing_edited', {
                      when: formatEditedAgo(resume.editedAt, now ?? new Date(), i18n.language),
                    }),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Button onPress={() => onContinue(resume.id)} testID="story-writing-continue">
                {canEdit ? t('story_writing_continue') : t('story_writing_open')}
              </Button>
            </View>
          </View>
        ) : null}

        {chips.length > 0 ? (
          <View style={styles.chips}>
            {chips.map((chip) => (
              <TouchableOpacity
                key={chip.id}
                style={styles.chip}
                testID={`story-writing-${chip.id}`}
                onPress={chip.onPress}
              >
                <Ionicons name={chip.icon} size={16} color={colors.primary} />
                <Text style={styles.chipLabel}>{chip.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <View style={[styles.card, styles.manuscript]} testID="story-writing-manuscript">
          <View style={styles.row}>
            <Ionicons name="book-outline" size={24} color={colors.primary} />
            <View style={styles.body}>
              <Text style={styles.title}>{t('manuscript_title')}</Text>
              <Text style={styles.detail}>
                {hasManuscript ? manuscriptDetail : t('story_writing_manuscript_empty')}
              </Text>
            </View>
            <View style={styles.actions}>
              <Button onPress={onOpenManuscript} testID="story-writing-read">
                {t('story_writing_read')}
              </Button>
              <Button
                onPress={onExportManuscript}
                testID="story-writing-export"
                disabled={!hasManuscript}
              >
                {t('story_writing_export')}
              </Button>
              {onPublishManuscript ? (
                <Button onPress={onPublishManuscript} testID="story-writing-publish">
                  {t('story_writing_publish')}
                </Button>
              ) : null}
            </View>
          </View>
        </View>
      </DashboardSection>
    </View>
  );
};

export default StoryWritingSection;
