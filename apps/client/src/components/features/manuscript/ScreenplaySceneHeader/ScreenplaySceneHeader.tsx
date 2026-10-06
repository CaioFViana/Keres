import { sceneHeadingPlan } from '@keres/shared';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useDrizzle } from '@/src/db';
import type { SceneSelect } from '@/src/db/schema';
import { createChapterService } from '@/src/services/storymanagement/ChapterService';
import { createCharacterSceneService } from '@/src/services/storymanagement/CharacterSceneService';
import { createCharacterService } from '@/src/services/storymanagement/CharacterService';
import { createLocationService } from '@/src/services/storymanagement/LocationService';
import { createStoryArcService } from '@/src/services/storymanagement/StoryArcService';
import { useStoryStore } from '@/src/state/storyStore';
import { useTheme } from '@/src/theme';
import { entityEventEmitter } from '@/src/utils/EventEmitter';

type Place = { name: string; intExt: 'interior' | 'exterior' | 'both' | null } | null;

/**
 * What the scene's own screenplay screen has to show: the place and whether it is indoors or out, who is
 * in the scene, and where the scene heading comes from. `null` while loading or when the scene is not
 * part of a screenplay.
 */
export function useScreenplaySceneContext(scene: SceneSelect, bodyText: string) {
  const db = useDrizzle();
  const effectiveArc = useStoryStore((state) => state.effectiveArc);
  const [arcMedium, setArcMedium] = useState<string | null>(null);
  const [place, setPlace] = useState<Place>(null);
  const [cast, setCast] = useState<string[]>([]);

  // A scene belongs to the work of its chapter; one filed in no chapter takes the work in effect.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const chapter = scene.chapterId
          ? await createChapterService(db).getById(scene.chapterId)
          : undefined;
        // The arc's medium rides on its row; the store knows the one in effect, which is enough for
        // a scene with no chapter, and the chapter's arc is read from the arcs when it has one.
        if (chapter?.arcId) {
          const arc = await createStoryArcService(db).getById(chapter.arcId);
          if (alive) setArcMedium(arc?.medium ?? null);
        } else if (alive) {
          setArcMedium(effectiveArc?.medium ?? null);
        }
      } catch {
        if (alive) setArcMedium(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [db, scene.chapterId, effectiveArc?.medium]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const row = scene.locationId
          ? await createLocationService(db).getById(scene.locationId)
          : undefined;
        if (alive) setPlace(row && !row.isDeleted ? { name: row.name, intExt: row.intExt } : null);
        const relations = await createCharacterSceneService(db).getRelationsForScene(
          scene.storyId,
          scene.id,
        );
        const characters = await Promise.all(
          relations.map((relation) => createCharacterService(db).getById(relation.characterId)),
        );
        if (alive) {
          setCast(
            characters.flatMap((character) =>
              character && !character.isDeleted ? [character.name] : [],
            ),
          );
        }
      } catch {
        if (alive) {
          setPlace(null);
          setCast([]);
        }
      }
    };
    void load();
    entityEventEmitter.on('location_changed', load);
    entityEventEmitter.on('character_changed', load);
    return () => {
      alive = false;
      entityEventEmitter.off('location_changed', load);
      entityEventEmitter.off('character_changed', load);
    };
  }, [db, scene.id, scene.locationId, scene.storyId]);

  const plan = useMemo(
    () => sceneHeadingPlan({ body: bodyText, location: place }),
    [bodyText, place],
  );
  return { isScreenplay: arcMedium === 'screenplay', place, cast, plan };
}

interface ScreenplaySceneHeaderProps {
  place: Place;
  cast: string[];
  plan: ReturnType<typeof sceneHeadingPlan>;
}

/**
 * Above the text of a screenplay scene: the facts the script is built from, and - spoken plainly - where
 * the scene heading will come from, so nobody is surprised by one they did not type (or by its absence).
 */
export const ScreenplaySceneHeader: React.FC<ScreenplaySceneHeaderProps> = ({
  place,
  cast,
  plan,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    box: {
      backgroundColor: colors.surface,
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      gap: 4,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    row: { color: colors.text },
    label: { color: colors.textSecondary, fontWeight: '700' },
    heading: { color: colors.text, fontFamily: 'Courier', fontWeight: '700' },
    note: { color: colors.textSecondary, lineHeight: 18 },
    warn: { color: colors.error, lineHeight: 18 },
  });

  return (
    <View style={styles.box} testID="screenplay-scene-header">
      <Text style={styles.row} testID="screenplay-place">
        <Text style={styles.label}>{t('screenplay_scene_place')}: </Text>
        {place
          ? `${place.name}${place.intExt ? ` (${t(`int_ext_${place.intExt}`)})` : ''}`
          : t('screenplay_scene_no_place')}
      </Text>
      <Text style={styles.row} testID="screenplay-cast">
        <Text style={styles.label}>{t('screenplay_scene_cast')}: </Text>
        {cast.length > 0 ? cast.join(', ') : t('screenplay_scene_no_cast')}
      </Text>
      {plan.heading ? (
        <Text style={styles.row} testID="screenplay-heading">
          <Text style={styles.label}>{t('screenplay_scene_heading')}: </Text>
          <Text style={styles.heading}>{plan.heading.replace(/^\./, '')}</Text>
        </Text>
      ) : null}
      <Text
        style={plan.source === 'none' ? styles.warn : styles.note}
        testID={`screenplay-heading-${plan.source}`}
      >
        {t(`screenplay_scene_heading_${plan.source}`)}
      </Text>
    </View>
  );
};
