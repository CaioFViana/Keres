import { Navigate, Route, Routes } from 'react-router-dom';
import { ShowcaseAuthProvider } from './auth/ShowcaseAuthProvider';
import { Layout } from './components/Layout';
import { ShowcaseConfigProvider } from './config/ShowcaseConfigProvider';
import { AboutPage } from './pages/AboutPage';
import { HomePage } from './pages/HomePage';
import { PackPage } from './pages/PackPage';
import { PacksPage } from './pages/PacksPage';
import { ReaderPage } from './pages/ReaderPage';
import { StoryPage } from './pages/StoryPage';
import { ShowcaseThemeProvider } from './theme/ShowcaseThemeProvider';

/**
 * The public site. Sign-in exists only for one reason - unlocking the adults-only shelf for
 * verified readers - and lives in its own tab-scoped session: no path to `/admin`, which stays
 * another app, another build, another prefix.
 */
export function ShowcaseApp() {
  return (
    <ShowcaseThemeProvider>
      <ShowcaseConfigProvider>
        <ShowcaseAuthProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/story/:storyId" element={<StoryPage />} />
              <Route path="/story/:storyId/read/:publicationId" element={<ReaderPage />} />
              <Route path="/packs" element={<PacksPage />} />
              <Route path="/pack/:packId" element={<PackPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </ShowcaseAuthProvider>
      </ShowcaseConfigProvider>
    </ShowcaseThemeProvider>
  );
}
