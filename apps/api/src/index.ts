import { Hono } from 'hono';
import userRoutes from './presentation/routes/UserRoutes';
import storyRoutes from './presentation/routes/StoryRoutes';
import characterRoutes from './presentation/routes/CharacterRoutes';
import chapterRoutes from './presentation/routes/ChapterRoutes';
import sceneRoutes from './presentation/routes/SceneRoutes';
import momentRoutes from './presentation/routes/MomentRoutes';
import locationRoutes from './presentation/routes/LocationRoutes';
import galleryRoutes from './presentation/routes/GalleryRoutes';
import relationRoutes from './presentation/routes/RelationRoutes';
import characterMomentRoutes from './presentation/routes/CharacterMomentRoutes';
import characterRelationRoutes from './presentation/routes/CharacterRelationRoutes';

const app = new Hono();

app.onError((err, c) => {
  console.error(`${err}`);
  return c.text('Internal Server Error', 500);
});

app.get('/', (c) => {
  return c.text('Hello Hono!');
});

app.route('/users', userRoutes);
app.route('/stories', storyRoutes);
app.route('/characters', characterRoutes);
app.route('/chapters', chapterRoutes);
app.route('/scenes', sceneRoutes);
app.route('/moments', momentRoutes);
app.route('/locations', locationRoutes);
app.route('/gallery', galleryRoutes);
app.route('/relations', relationRoutes);
app.route('/character-moments', characterMomentRoutes);
app.route('/character-relations', characterRelationRoutes);

export default app;
