import { getEntityAppearance, SEE_ALSO_ENTITY_TYPES } from '@keres/shared';
import type { SeeAlsoEntityType } from '@keres/shared';
import type { NavigableEntityType } from '@/src/utils/entityNavigation';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CollapsibleCard from '@/src/components/common/display/CollapsibleCard/CollapsibleCard';
import EntityRelationList from '@/src/components/common/display/EntityRelationList/EntityRelationList';
import { useNavigateToEntityDetail } from '@/src/hooks/useNavigateToEntityDetail';
import { useResolveAmbiguousMention } from '@/src/hooks/useResolveAmbiguousMention';
import { useSeeAlsoRelations } from '@/src/hooks/useSeeAlsoRelations';
import { useStoryRole } from '@/src/hooks/useStoryRole';
import { useAmbiguousMentions, useMentionBacklinks } from '@/src/mentions/MentionContext';
import type { AmbiguousMention } from '@/src/mentions/mentionBacklinks';
import { useStoryStore } from '@/src/state/storyStore';
import { useTheme } from '@/src/theme';
import type { MentionableEntity } from '@/src/utils/entityMentions';
import { isStoryVocabularyEntityType } from '@/src/vocabulary/resolveStoryTerm';
import { useStoryVocabulary } from '@/src/vocabulary/useStoryVocabulary';

interface Props {
  entityType: NavigableEntityType;
  entityId: string;
}

/**
 * Schema field to its detail-screen label key. Every mention source field has one; an
 * unknown future field degrades to its raw key rather than hiding the occurrence.
 */
const MENTION_FIELD_LABEL_KEYS: Record<string, string> = {
  description: 'description',
  personality: 'personality',
  motivation: 'motivation',
  qualities: 'qualities',
  weaknesses: 'weaknesses',
  biography: 'biography',
  plannedTimeline: 'planned_timeline',
  extraNotes: 'extra_notes',
  climate: 'field_climate',
  culture: 'field_culture',
  politics: 'field_politics',
  summary: 'summary',
  body: 'body',
  type: 'world_piece_type',
  category: 'category',
  behavior: 'world_piece_behavior',
  usability: 'world_piece_usability',
  danger: 'world_piece_danger',
  details: 'field_details',
};

const mentionFieldLabelKey = (field: string) =>
  field.startsWith('custom:') ? 'custom_attribute' : (MENTION_FIELD_LABEL_KEYS[field] ?? field);

const SEE_ALSO_TYPES = new Set<string>(SEE_ALSO_ENTITY_TYPES);

type SeeAlsoCandidate = MentionableEntity & { type: SeeAlsoEntityType };

const isSeeAlsoCandidate = (entity: MentionableEntity): entity is SeeAlsoCandidate =>
  SEE_ALSO_TYPES.has(entity.type);

type ResolvableSuggestion = Omit<AmbiguousMention, 'candidates'> & {
  candidates: SeeAlsoCandidate[];
};

/** The read-only counterpart to See also: derived from the story's automatic prose links. */
export const MentionBacklinksSection: React.FC<Props> = ({ entityType, entityId }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { term } = useStoryVocabulary();
  const navigate = useNavigateToEntityDetail();
  const backlinks = useMentionBacklinks(entityType, entityId);
  const ambiguous = useAmbiguousMentions(entityType, entityId);
  const storyId = useStoryStore((state) => state.selectedStory?.id);
  const { canEdit } = useStoryRole(storyId);
  const resolveAmbiguous = useResolveAmbiguousMention();
  // Harmless for Note/Plot sources (their type never appears in a see-also row, so this
  // stays empty); the suggestions card below only renders for see-also-able sources.
  const { relations } = useSeeAlsoRelations(storyId, entityType as SeeAlsoEntityType, entityId);
  const totalMentions = backlinks.reduce((total, entry) => total + entry.mentionCount, 0);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        field: {
          color: colors.textSecondary,
          fontSize: 11,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
        excerpt: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
        hint: { color: colors.textSecondary, fontSize: 13, marginBottom: 8 },
        suggestion: { marginBottom: 12 },
        suggestionName: { color: colors.text, fontSize: 14, fontWeight: '600' },
        candidateType: { color: colors.textSecondary, fontSize: 12 },
        resolveButton: { padding: 8 },
      }),
    [colors],
  );

  const occurrenceItems = useMemo(
    () =>
      backlinks.flatMap((entry) => {
        const appearance = getEntityAppearance(entry.source.type);
        return entry.occurrences.map((occurrence) => ({
          id: `${entry.source.type}:${entry.source.id}:${occurrence.field}`,
          title: entry.source.name,
          icon: appearance.icon as any,
          color: appearance.color,
          details: (
            <View>
              <Text style={styles.field}>
                {t(mentionFieldLabelKey(occurrence.field))}
                {occurrence.mentionCount > 1 ? ` · ×${occurrence.mentionCount}` : ''}
              </Text>
              <Text style={styles.excerpt} numberOfLines={2}>
                {occurrence.excerpt}
              </Text>
            </View>
          ),
          onPress: () =>
            navigate(entry.source.type, entry.source.id, {
              occurrence: { field: occurrence.field, needle: occurrence.needle },
            }),
        }));
      }),
    [backlinks, navigate, styles, t],
  );

  // Suggestions the writer can still act on: see-also-able claimants not already linked.
  // Resolving one emits `see_also_relation_changed`, the relations above refresh, and the
  // candidate (or the whole suggestion) quietly drops out of this list.
  const resolvableSuggestions: ResolvableSuggestion[] = useMemo(() => {
    if (!SEE_ALSO_TYPES.has(entityType) || !canEdit) return [];
    const linked = new Set(
      relations.map((relation) => `${relation.otherType}:${relation.otherId}`),
    );
    return ambiguous.flatMap((suggestion) => {
      const candidates = suggestion.candidates
        .filter(isSeeAlsoCandidate)
        .filter((candidate) => !linked.has(`${candidate.type}:${candidate.id}`));
      const resolvable: ResolvableSuggestion = { ...suggestion, candidates };
      return candidates.length > 0 ? [resolvable] : [];
    });
  }, [ambiguous, canEdit, entityType, relations]);

  const handleResolve = (candidate: SeeAlsoCandidate) => {
    if (!storyId) return;
    void resolveAmbiguous(
      storyId,
      { entityType: entityType as SeeAlsoEntityType, entityId },
      { entityType: candidate.type, entityId: candidate.id },
    );
  };

  return (
    <>
      <CollapsibleCard
        title={t('backlinks_title', { entities: backlinks.length, mentions: totalMentions })}
        initialExpanded={false}
      >
        <EntityRelationList emptyText={t('backlinks_empty')} items={occurrenceItems} />
      </CollapsibleCard>
      {resolvableSuggestions.length > 0 && (
        <CollapsibleCard
          title={t('ambiguous_mentions_title', { count: resolvableSuggestions.length })}
          initialExpanded={false}
        >
          <Text style={styles.hint}>{t('ambiguous_mentions_hint')}</Text>
          {resolvableSuggestions.map((suggestion) => (
            <View
              key={`${suggestion.name}:${suggestion.field}`}
              style={styles.suggestion}
              testID={`ambiguous-mention-${suggestion.field}`}
            >
              <Text style={styles.suggestionName}>
                {`"${suggestion.name}" · ${t(mentionFieldLabelKey(suggestion.field))}`}
                {suggestion.mentionCount > 1 ? ` · ×${suggestion.mentionCount}` : ''}
              </Text>
              <Text style={styles.excerpt} numberOfLines={2}>
                {suggestion.excerpt}
              </Text>
              <EntityRelationList
                emptyText=""
                items={suggestion.candidates.map((candidate) => {
                  const appearance = getEntityAppearance(candidate.type);
                  return {
                    id: `${candidate.type}:${candidate.id}`,
                    title: candidate.name,
                    icon: appearance.icon as any,
                    color: appearance.color,
                    details: (
                      <Text style={styles.candidateType}>
                        {isStoryVocabularyEntityType(candidate.type)
                          ? term(candidate.type)
                          : candidate.type}
                      </Text>
                    ),
                    trailing: (
                      <TouchableOpacity
                        style={styles.resolveButton}
                        onPress={() => handleResolve(candidate)}
                        accessibilityRole="button"
                        accessibilityLabel={t('ambiguous_mentions_resolve', {
                          name: candidate.name,
                        })}
                        testID={`ambiguous-resolve-${candidate.type}-${candidate.id}`}
                      >
                        <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                      </TouchableOpacity>
                    ),
                  };
                })}
              />
            </View>
          ))}
        </CollapsibleCard>
      )}
    </>
  );
};
