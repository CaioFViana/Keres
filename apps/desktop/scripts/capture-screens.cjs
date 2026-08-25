/**
 * Tira as fotos das telas do app para a vitrine do site.
 *
 * Roda o app de verdade dentro do Electron - o mesmo host que o desktop entrega ao usuário -
 * e fotografa cada tela pedida. Nada de navegador de automação: o Electron já é dependência
 * daqui e já resolve o que o app web precisa (protocolo `app://` com COOP/COEP, sem o qual o
 * SQLite do navegador não abre).
 *
 * Cada foto sai de uma URL que o modo vitrine do app entende (ver `showcaseRequest.ts`), então
 * não há clique nenhum a simular: abrir, esperar, fotografar.
 *
 *   bun run --cwd apps/desktop capture:screens
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const desktopRoot = path.resolve(__dirname, '..');
const clientRoot = path.resolve(desktopRoot, '..', 'client');
const outputDirectory = path.resolve(desktopRoot, '..', 'site', 'public', 'showcase', 'screens');
const electronBinary = require('electron');

/**
 * As telas da vitrine.
 *
 * `story` escolhe a história de exemplo, e cada tela usa a que melhor a preenche: o mapa da
 * história precisa de uma ramificada, o elenco grande vive na Kaguya, as tramas na Cinderela.
 */
const ONLY = process.env.KERES_CAPTURE_ONLY;
/**
 * Só os grafos compactos pedem "ajustar à tela": nos grandes (mapa da história, matriz,
 * linha do tempo) o ajuste encolhe tudo a ponto de não se ler nada, e a foto fica melhor com o
 * desenho em tamanho real saindo pela borda - que é como o app se apresenta ao abrir.
 */
const FIT = { en: 'Fit to screen', pt: 'Ajustar à tela' };
const SCREENS = [
  { name: 'narrative-elements', stack: 'NarrativeElementsStack', story: 'cinderella' },
  // O clique abre o item na própria lista - é assim que o app mostra um personagem sem trocar
  // de tela. O nome é igual nos dois idiomas, então serve para as duas capturas.
  { name: 'character-list', stack: 'CharactersStack', story: 'princess-kaguya', press: { en: 'Kaguya-hime', pt: 'Kaguya-hime' } },
  // O painel abre com o resumo recolhido; sem o clique a foto seria uma página quase vazia.
  { name: 'dashboard', stack: 'MainDashboard', story: 'cinderella', press: { en: 'Story Overview', pt: 'Visão Geral da História' }, pressWaitMs: 2500 },
  { name: 'story-map', stack: 'NarrativeElementsStack', screen: 'ChoiceView', story: 'alice-in-wonderland', settleMs: 2500 },
  // Sem "ajustar à tela" aqui: nesta tela o ajuste empurra a coluna de nomes das cenas para
  // fora do quadro. A vista de abertura já mostra a linha do tempo inteira.
  { name: 'story-timeline', stack: 'NarrativeElementsStack', screen: 'StoryTimeline', story: 'little-mermaid', settleMs: 2500 },
  { name: 'plot-coverage', stack: 'PlotsStack', screen: 'PlotProgress', story: 'cinderella', viewport: { width: 1440, height: 620 } },
  { name: 'plot-matrix', stack: 'PlotsStack', screen: 'PlotMatrix', story: 'cinderella', settleMs: 2500 },
  { name: 'location-map', stack: 'LocationsStack', screen: 'LocationView', story: 'little-mermaid', settleMs: 3500, press: FIT, viewport: { width: 1440, height: 560 } },
  { name: 'relation-map', stack: 'CharactersStack', screen: 'CharacterRelationView', story: 'princess-kaguya', settleMs: 3500, press: FIT },
];

const LANGUAGES = (process.env.KERES_CAPTURE_LANGS || 'en,pt').split(',');
const THEMES = (process.env.KERES_CAPTURE_THEMES || 'light,dark').split(',');
/**
 * Desktop largo o bastante para a gaveta aberta, que é como o app se apresenta em tela grande.
 * Uma tela pode pedir outra altura (`viewport`) quando o conteúdo é baixo e a janela cheia
 * fotografaria meia página vazia.
 */
const VIEWPORT = { width: 1440, height: 900 };

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} terminou com ${signal || `código ${code}`}.`));
    });
  });
}

function buildPlan() {
  const shots = [];
  for (const screen of SCREENS.filter((s) => !ONLY || s.name === ONLY)) {
    for (const language of LANGUAGES) {
      for (const theme of THEMES) {
        const query = new URLSearchParams({
          showcase: screen.story,
          stack: screen.stack,
          theme,
          lang: language,
        });
        if (screen.screen) query.set('screen', screen.screen);
        shots.push({
          name: `${screen.name}.${language}.${theme}`,
          query: query.toString(),
          width: screen.viewport?.width ?? VIEWPORT.width,
          height: screen.viewport?.height ?? VIEWPORT.height,
          settleMs: screen.settleMs,
          press: screen.press?.[language],
          pressWaitMs: screen.pressWaitMs,
        });
      }
    }
  }
  return { outputDirectory, shots };
}

async function main() {
  const skipBuild = process.argv.includes('--skip-build');
  if (!skipBuild) {
    await run('bun', ['run', 'export:web'], { cwd: clientRoot });
    await run('bun', ['run', 'build:main'], { cwd: desktopRoot });
  }

  const plan = buildPlan();
  const planDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'keres-capture-'));
  const planPath = path.join(planDirectory, 'plan.json');
  await fs.writeFile(planPath, JSON.stringify(plan), 'utf8');

  // Perfil novo a cada execução: o app guarda história instalada e tema no próprio banco, e
  // uma sobra da execução anterior mudaria a foto sem ninguém perceber.
  const userDataDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'keres-capture-profile-'));
  try {
    await run(electronBinary, [
      '.',
      `--capture-screens=${planPath}`,
      `--user-data-dir=${userDataDirectory}`,
    ], { cwd: desktopRoot });
    console.log(`[capture] ${plan.shots.length} imagens em ${outputDirectory}`);
  } finally {
    await fs.rm(planDirectory, { recursive: true, force: true });
    await fs.rm(userDataDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('[capture]', error);
  process.exitCode = 1;
});
