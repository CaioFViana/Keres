import { and, eq, inArray, sql } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db } from '../db';
import { scenes, choices } from '../db/schema';

/**
 * Recalculates and recreates implicit choices for all scenes within a given chapter.
 * This function should be called whenever the order of scenes in a linear story chapter changes.
 *
 * @param storyId The ID of the story.
 * @param chapterId The ID of the chapter.
 */
export async function recreateImplicitChoicesForChapter(storyId: string, chapterId: string): Promise<void> {
    const chapterScenes = await db.query.scenes.findMany({
        where: and(
            eq(scenes.chapterId, chapterId),
            eq(scenes.isDeleted, false),
            eq(scenes.storyId, storyId)
        ),
        orderBy: scenes.index,
    });

    const chapterSceneIds = chapterScenes.map(s => s.id);

    // Delete all existing implicit choices for this chapter's scenes
    // Use a transaction to ensure atomicity
    await db.transaction(async (tx) => {
        if (chapterSceneIds.length > 0) {
            await tx.delete(choices).where(and(
                eq(choices.storyId, storyId),
                eq(choices.isImplicit, true),
                inArray(choices.sceneId, chapterSceneIds)
            ));
        }

        const newImplicitChoices = [];
        for (let i = 0; i < chapterScenes.length - 1; i++) {
            const currentScene = chapterScenes[i];
            const nextScene = chapterScenes[i + 1];
            newImplicitChoices.push({
                id: ulid(),
                storyId: storyId,
                sceneId: currentScene.id,
                nextSceneId: nextScene.id,
                text: 'Auto Generated For Linear.',
                isImplicit: true,
                version: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
                isDeleted: false,
                deletedAt: null,
            });
        }

        if (newImplicitChoices.length > 0) {
            await tx.insert(choices).values(newImplicitChoices);
        }
    });
}
