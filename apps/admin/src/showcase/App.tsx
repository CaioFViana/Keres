import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AboutPage } from './pages/AboutPage';
import { HomePage } from './pages/HomePage';
import { StoryPage } from './pages/StoryPage';
import { ShowcaseThemeProvider } from './theme/ShowcaseThemeProvider';

/**
 * The public site. No login, no session route and no path to `/admin` - the administration panel
 * is another app, with another build, served under another prefix.
 */
export function ShowcaseApp() {
  return (
    <ShowcaseThemeProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/story/:storyId" element={<StoryPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </ShowcaseThemeProvider>
  );
}
