import { OpenAPIHono } from '@hono/zod-openapi' // Import OpenAPIHono

import chapterRoutes from './presentation/routes/ChapterRoutes'
import characterMomentRoutes from './presentation/routes/CharacterMomentRoutes'
import characterRelationRoutes from './presentation/routes/CharacterRelationRoutes'
import characterRoutes from './presentation/routes/CharacterRoutes'
import galleryRoutes from './presentation/routes/GalleryRoutes'
import locationRoutes from './presentation/routes/LocationRoutes'
import momentRoutes from './presentation/routes/MomentRoutes'
import relationRoutes from './presentation/routes/RelationRoutes'
import sceneRoutes from './presentation/routes/SceneRoutes'
import storyRoutes from './presentation/routes/StoryRoutes'
import userRoutes from './presentation/routes/UserRoutes'
import { swaggerUI } from '@hono/swagger-ui'

const app = new OpenAPIHono() // Change Hono to OpenAPIHono

app.onError((err, c) => {
  console.error(`${err}`)
  return c.text('Internal Server Error', 500)
})

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.route('/users', userRoutes)
app.route('/stories', storyRoutes)
app.route('/characters', characterRoutes)
app.route('/chapters', chapterRoutes)
app.route('/scenes', sceneRoutes)
app.route('/moments', momentRoutes)
app.route('/locations', locationRoutes)
app.route('/gallery', galleryRoutes)
app.route('/relations', relationRoutes)
app.route('/character-moments', characterMomentRoutes)
app.route('/character-relations', characterRelationRoutes)

// Define OpenAPI document metadata
app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Keres API',
    description: 'API for the Keres Story Organizer application.',
  },
})
app.get(
  '/swagger',
  swaggerUI({
    url: '/openapi.json',
  }),
)

export default app
