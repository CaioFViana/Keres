import { swaggerUI } from '@hono/swagger-ui'
import { extendZodWithOpenApi, OpenAPIHono } from '@hono/zod-openapi'
import { authMiddleware } from '@presentation/middlewares/AuthMiddleware' // Added
import { z } from 'zod'

import chapterRoutes from './presentation/routes/ChapterRoutes'
import characterMomentRoutes from './presentation/routes/CharacterMomentRoutes'
import characterRelationRoutes from './presentation/routes/CharacterRelationRoutes'
import characterRoutes from './presentation/routes/CharacterRoutes'
import choiceRoutes from './presentation/routes/ChoiceRoutes' // Added
import galleryRoutes from './presentation/routes/GalleryRoutes'
import locationRoutes from './presentation/routes/LocationRoutes'
import momentRoutes from './presentation/routes/MomentRoutes'
import noteRoutes from './presentation/routes/NoteRoutes' // Added
import sceneRoutes from './presentation/routes/SceneRoutes'
import searchRoutes from './presentation/routes/SearchRoutes' // Added
import storyRoutes from './presentation/routes/StoryRoutes'
import suggestionRoutes from './presentation/routes/SuggestionRoutes' // Added
import tagRoutes from './presentation/routes/TagRoutes' // Added
import userRoutes from './presentation/routes/UserRoutes'
import worldRuleRoutes from './presentation/routes/WorldRuleRoutes' // Added

extendZodWithOpenApi(z)

const app = new OpenAPIHono() // Change Hono to OpenAPIHono

app.onError((err, c) => {
  console.error(`${err}`)
  return c.text('Internal Server Error', 500)
})

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

// Define OpenAPI document metadata
app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Keres API',
    description: 'API for the Keres Story Organizer application.',
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
})
// No middleware routes.
app.get(
  '/swagger',
  swaggerUI({
    url: '/openapi.json',
  }),
)

app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
})

app.route('/users', userRoutes) // Public routes
app.use(authMiddleware) // Apply middleware to all subsequent routes
app.route('/stories', storyRoutes)
//app.route('/characters', characterRoutes)
//app.route('/chapters', chapterRoutes)
//app.route('/scenes', sceneRoutes)
//app.route('/moments', momentRoutes)
//app.route('/locations', locationRoutes)
//app.route('/gallery', galleryRoutes)
//app.route('/character-moments', characterMomentRoutes)
//app.route('/character-relations', characterRelationRoutes)
//app.route('/choices', choiceRoutes)
//app.route('/world-rules', worldRuleRoutes)
//app.route('/notes', noteRoutes)
//app.route('/tags', tagRoutes)
//app.route('/suggestions', suggestionRoutes)
//app.route('/search', searchRoutes)

export default app
