const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let apiProcess = null;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Inicia o processo da API
  startApiProcess();

  // Carrega o frontend web (build do apps/client)
  // Em desenvolvimento, você pode carregar o servidor de desenvolvimento do Expo:
  // mainWindow.loadURL('http://localhost:8081'); // Ou a porta que o Expo usa para web
  // Em produção, carregue o build estático:
  mainWindow.loadFile(path.join(__dirname, '../client/web-build/index.html'));

  // Abrir DevTools (opcional)
  // mainWindow.webContents.openDevTools();
}

function startApiProcess() {
  // Define as variáveis de ambiente para o modo offline
  process.env.APP_MODE = 'offline';
  process.env.DATABASE_TYPE = 'sqlite';
  // Caminho absoluto para o arquivo SQLite dentro do diretório de dados do Electron
  process.env.DATABASE_URL = `file:${path.join(app.getPath('userData'), 'keres.sqlite')}`;
  process.env.JWT_SECRET = 'your_fixed_offline_jwt_secret'; // Use um segredo fixo para offline

  // Caminho para o executável do Node.js e o script de inicialização da API
  const apiPath = path.join(__dirname, '../api/dist/index.js');

  // Inicia a API como um processo filho
  apiProcess = spawn('node', [apiPath], {
    stdio: 'inherit', // Redireciona stdout/stderr para o console do Electron
    env: process.env, // Passa as variáveis de ambiente
  });

  apiProcess.on('close', (code) => {
    console.log(`API process exited with code ${code}`);
  });

  apiProcess.on('error', (err) => {
    console.error('Failed to start API process:', err);
  });

  console.log('API process started in offline mode.');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  // Garante que o processo da API seja encerrado ao fechar o Electron
  if (apiProcess) {
    apiProcess.kill();
    console.log('API process terminated.');
  }
});

// Exemplo de comunicação IPC (opcional)
ipcMain.on('get-api-url', (event) => {
  // A API estará rodando em localhost, mas a porta pode ser dinâmica.
  // Para simplificar, assumimos uma porta fixa ou que o frontend saiba como descobrir.
  // Para um setup mais robusto, a API poderia escrever sua porta em um arquivo temporário.
  event.returnValue = 'http://localhost:3000'; // Exemplo: porta padrão do Hono
});