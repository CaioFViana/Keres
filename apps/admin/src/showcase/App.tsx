import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AboutPage } from './pages/AboutPage';
import { HomePage } from './pages/HomePage';
import { StoryPage } from './pages/StoryPage';
import { ShowcaseThemeProvider } from './theme/ShowcaseThemeProvider';

/**
 * O site público. Sem login, sem rota de sessão e sem nenhum caminho para `/admin` - o painel
 * administrativo é outro app, com outro build, servido em outro prefixo.
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
