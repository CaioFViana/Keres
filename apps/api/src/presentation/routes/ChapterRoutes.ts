import { Hono } from 'hono';
import { ChapterController } from '@presentation/controllers/ChapterController';
import {
  CreateChapterUseCase,
  GetChapterUseCase,
  GetChaptersByStoryIdUseCase,
  UpdateChapterUseCase,
  DeleteChapterUseCase,
} from '@application/use-cases';
import { ChapterRepository } from '@infrastructure/persistence/ChapterRepository';

const chapterRoutes = new Hono();

// Dependencies for ChapterController
const chapterRepository = new ChapterRepository();
const createChapterUseCase = new CreateChapterUseCase(chapterRepository);
const getChapterUseCase = new GetChapterUseCase(chapterRepository);
const getChaptersByStoryIdUseCase = new GetChaptersByStoryIdUseCase(chapterRepository);
const updateChapterUseCase = new UpdateChapterUseCase(chapterRepository);
const deleteChapterUseCase = new DeleteChapterUseCase(chapterRepository);

const chapterController = new ChapterController(
  createChapterUseCase,
  getChapterUseCase,
  getChaptersByStoryIdUseCase,
  updateChapterUseCase,
  deleteChapterUseCase
);

chapterRoutes.post('/', (c) => chapterController.createChapter(c));
chapterRoutes.get('/:id', (c) => chapterController.getChapter(c));
chapterRoutes.get('/story/:storyId', (c) => chapterController.getChaptersByStoryId(c));
chapterRoutes.put('/:id', (c) => chapterController.updateChapter(c));
chapterRoutes.delete('/:id', (c) => chapterController.deleteChapter(c));

export default chapterRoutes;
