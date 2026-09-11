import type { FullStoryExportType } from '@keres/shared';
import { DatabaseStoryPackageExporter } from './story-packages/DatabaseStoryPackageExporter';
import { DatabaseStoryPackageImporter } from './story-packages/DatabaseStoryPackageImporter';

export class StoryExportImportService {
  constructor(
    private readonly exporter = new DatabaseStoryPackageExporter(),
    private readonly importer = new DatabaseStoryPackageImporter(),
  ) {}

  async exportStory(storyId: string, userId?: string): Promise<FullStoryExportType> {
    return this.exporter.exportStory(storyId, userId);
  }

  async importStory(userId: string, fullStoryJSON: unknown, newStoryId?: string): Promise<string> {
    return this.importer.importStory(userId, fullStoryJSON, newStoryId);
  }
}
