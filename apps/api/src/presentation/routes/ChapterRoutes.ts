import {
  CreateChapterUseCase,
  DeleteChapterUseCase,
  GetChaptersByStoryIdUseCase,
  GetChapterUseCase,
  UpdateChapterUseCase,
} from '@application/use-cases'
import { zValidator } from '@hono/zod-validator'
import { ChapterRepository } from '@infrastructure/persistence/ChapterRepository'
import { ChapterCreateSchema, ChapterUpdateSchema } from '@keres/shared'
import { ChapterController } from '@presentation/controllers/ChapterController'
import { Hono } from 'hono'

console.log('Initializing ChapterRoutes...')

const chapterRoutes = new Hono()

// Dependencies for ChapterController
console.log('Instantiating ChapterRepository...')
const chapterRepository = new ChapterRepository()
console.log('Instantiating CreateChapterUseCase...')
const createChapterUseCase = new CreateChapterUseCase(chapterRepository)
console.log('Instantiating GetChapterUseCase...')
const getChapterUseCase = new GetChapterUseCase(chapterRepository)
console.log('Instantiating UpdateChapterUseCase...')
const updateChapterUseCase = new UpdateChapterUseCase(chapterRepository)
console.log('Instantiating DeleteChapterUseCase...')
const deleteChapterUseCase = new DeleteChapterUseCase(chapterRepository)
console.log('Instantiating GetChaptersByStoryIdUseCase...')
const getChaptersByStoryIdUseCase = new GetChaptersByStoryIdUseCase(chapterRepository)

console.log('Instantiating ChapterController...')
const chapterController = new ChapterController(
  createChapterUseCase,
  getChapterUseCase,
  updateChapterUseCase,
  deleteChapterUseCase,
  getChaptersByStoryIdUseCase,
)

chapterRoutes.post('/', zValidator('json', ChapterCreateSchema), (c) =>
  chapterController.createChapter(c),
)
chapterRoutes.get('/:id', (c) => chapterController.getChapter(c))
chapterRoutes.get('/story/:storyId', (c) => chapterController.getChaptersByStoryId(c))
chapterRoutes.put('/:id', zValidator('json', ChapterUpdateSchema), (c) =>
  chapterController.updateChapter(c),
)
chapterRoutes.delete('/:id', (c) => chapterController.deleteChapter(c))

console.log('ChapterRoutes initialized.')

export default chapterRoutes
