import type {
  CalendarDefinitionType,
  CommentEntityType,
  StorySchemaEntityType,
} from '@keres/shared';
import {
  AttributeType,
  calendarMoonPhases,
  calendarSeasonFor,
  dayNumberToParts,
  decodeAttributeValue,
  formatAttributeDateForDisplay,
  formatCalendarDate,
  joinSuggestionListForDisplay,
} from '@keres/shared';
import { useCustomAttributeValues } from '@/src/hooks/useCustomAttributeValues';
import { useStoryCalendar } from '@/src/hooks/useStoryCalendar';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useEntityComments } from '../../../../hooks/useEntityComments';
import { useNavigateToEntityDetail } from '../../../../hooks/useNavigateToEntityDetail';
import { useStorySchemaFields } from '../../../../hooks/useStorySchemaFields';
import { useUserSettingsStore } from '../../../../state/userSettingsStore';
import CommentableDetailField from '@/src/components/features/comments/CommentableDetailField/CommentableDetailField';

interface CustomAttributeDetailFieldsProps {
  storyId: string;
  entityType: StorySchemaEntityType;
  entityId: string;
}

function formatValueForDisplay(
  type: AttributeType | string,
  decoded: string | number | boolean | string[] | null,
  t: (key: string) => string,
  language: string,
  use24HourTime: boolean,
  /** The story's primary calendar, needed only by `STORY_DATE`. */
  calendar: CalendarDefinitionType | null,
): string {
  if (decoded === null) {
    return t('common_na');
  }
  if (Array.isArray(decoded) || type === AttributeType.SUGGESTION_LIST) {
    return joinSuggestionListForDisplay(Array.isArray(decoded) ? decoded : null) ?? t('common_na');
  }
  if (typeof decoded === 'boolean') {
    return decoded ? t('common_yes') : t('common_no');
  }
  if (type === AttributeType.STORY_DATE) {
    /*
     * A day number written in the story's own calendar, with its season and moons beside it. With
     * no calendar the number is shown raw rather than hidden - the value is still what the writer
     * entered, and swallowing it would look like data loss.
     */
    const dayNumber = Number(decoded);
    if (!calendar || !Number.isFinite(dayNumber)) return String(decoded);
    const parts = dayNumberToParts(calendar, dayNumber);
    const aside = [
      calendarSeasonFor(calendar, parts.dayOfYear)?.name,
      ...calendarMoonPhases(calendar, dayNumber).map(
        (moon) => `${moon.name}: ${t(`moon_phase_${moon.phase}`)}`,
      ),
    ].filter(Boolean);
    const date = formatCalendarDate(calendar, dayNumber);
    return aside.length > 0 ? `${date} · ${aside.join(' · ')}` : date;
  }
  if (type === AttributeType.DATE) {
    // Day of the week + the date spelled out in the APP's language (never the device's), always identical
    // in any time zone - see `attributeDateValue.ts`. The time follows the 24h/AM-PM format chosen in
    // Settings. Free-text values saved before the date picker existed are not canonical: they show up raw
    // instead of disappearing.
    return (
      formatAttributeDateForDisplay(String(decoded), language, use24HourTime) ?? String(decoded)
    );
  }
  return String(decoded);
}

/**
 * Renders a Story Schema's custom attributes on the detail screen, in the same visual pattern
 * (`DetailField`) the native fields already use - a single component reused by all 7 entity types, in
 * the same position on every screen: after the native fields, before the gallery/relations.
 */
const CustomAttributeDetailFields: React.FC<CustomAttributeDetailFieldsProps> = ({
  storyId,
  entityType,
  entityId,
}) => {
  const { t, i18n } = useTranslation();
  const use24HourTime = useUserSettingsStore((state) => state.use24HourTime);
  const navigateToDetail = useNavigateToEntityDetail();
  const fields = useStorySchemaFields(storyId, entityType);
  const { definition: calendar } = useStoryCalendar(storyId);
  const { values, resolvedEntityNames } = useCustomAttributeValues(storyId, entityId, fields);
  const {
    commentsByField,
    canComment,
    isStoryOwner,
    currentUserId,
    addComment,
    deleteComment,
    updateComment,
  } = useEntityComments(storyId, entityType as CommentEntityType, entityId);

  if (fields.length === 0) {
    return null;
  }

  return (
    <>
      {fields.map((field) => {
        // Entities that already existed before the field was created have no value of their own - they fall
        // back to the field's defaultValue (the most honest thing available) instead of showing N/A for
        // nothing.
        const rawValue = values[field.id] ?? field.defaultValue ?? null;
        const decoded = decodeAttributeValue(field.type as AttributeType, rawValue);
        const isEntityReference = field.type === AttributeType.ENTITY;
        const resolvedEntityName = resolvedEntityNames[field.id];
        const displayValue =
          isEntityReference && rawValue
            ? resolvedEntityName || t('attribute_entity_deleted')
            : formatValueForDisplay(field.type, decoded, t, i18n.language, use24HourTime, calendar);
        const onPress =
          isEntityReference && resolvedEntityName && field.targetEntityType && rawValue
            ? () => {
                navigateToDetail(field.targetEntityType as StorySchemaEntityType, rawValue);
              }
            : undefined;
        return (
          <CommentableDetailField
            key={field.id}
            storyId={storyId}
            label={field.name}
            value={displayValue}
            onPress={onPress}
            mentionSourceId={entityId}
            comments={commentsByField[field.id] ?? []}
            canComment={canComment}
            isStoryOwner={isStoryOwner}
            currentUserId={currentUserId}
            onAddComment={(input) =>
              addComment({ fieldId: field.id }, { ...input, contentSnapshot: displayValue })
            }
            onDeleteComment={deleteComment}
            onUpdateComment={updateComment}
          />
        );
      })}
    </>
  );
};

export default CustomAttributeDetailFields;
