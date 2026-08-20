export type LauncherLanguage = 'en' | 'pt';

export const en = {
  help: `Keres Server — run the Keres API without Docker.

Usage:
  keres-server                 Start (setup wizard on first run)
  keres-server --setup         Run the setup wizard again
  keres-server --config PATH   Use this config.json
  keres-server --non-interactive
                               Fail if config is missing (no prompts)
  keres-server --help
  keres-server --version`,
  language_title: 'Language / Idioma',
  language_en: 'English',
  language_pt: 'Português',
  database_title: 'Database',
  database_sqlite: 'SQLite — file on this computer, no extra software (recommended)',
  database_postgres: 'PostgreSQL — you already have a server',
  postgres_url_prompt: 'PostgreSQL URL (postgres://user:pass@host:5432/dbname)',
  postgres_needed: 'PostgreSQL must already be running. This program does not install it.',
  storage_title: 'Media storage',
  storage_local: 'Local folder on this computer (recommended)',
  storage_s3: 'Amazon S3 or compatible',
  s3_bucket: 'S3 bucket',
  s3_access_key: 'S3 access key id',
  s3_secret: 'S3 secret access key',
  s3_region: 'S3 region',
  s3_endpoint: 'S3 endpoint (empty = AWS)',
  port_prompt: 'HTTP port',
  bind_title: 'Who can connect',
  bind_localhost: 'This computer only (127.0.0.1)',
  bind_lan: 'Devices on the local network (0.0.0.0)',
  bind_lan_note: 'Local network has no HTTPS. Use only on a network you trust.',
  data_dir_prompt: 'Data folder (database, media, config)',
  admin_user_prompt: 'Admin username',
  admin_password_prompt: 'Admin password (empty = generate one)',
  default_marker: '(default — press Enter)',
  default_value: 'Default — press Enter: {{value}}',
  choice_prompt: 'Type 1 or 2, or press Enter for the default:',
  value_prompt: 'Type a value, or press Enter for the default:',
  input_prompt: '>',
  generated_password: 'Generated admin password (shown once): {{password}}',
  saved: 'Configuration saved at {{path}}',
  starting: 'Starting Keres Server…',
  listening: 'API: {{url}}',
  admin: 'Admin: {{url}}',
  swagger: 'Swagger: {{url}}',
  data_dir: 'Data: {{path}}',
  backup_hint: 'Backup: stop the server, then copy keres.db and media-storage/.',
  lan_addresses: 'This computer on the LAN: {{urls}}',
  lan_none: 'No LAN IPv4 address found.',
  lan_localhost_note:
    'The server only accepts connections on this computer. Choose local network in --setup to let a phone connect.',
  lan_changed: 'LAN address changed: {{urls}}',
  stop_hint: 'Ctrl+C to stop.',
  missing_config: 'No config.json found. Run without --non-interactive once, or pass --config.',
  driver_locked:
    'This data folder already uses {{current}}. Changing database engine is not supported. Use a new data folder.',
  invalid_choice: 'Please enter 1 or 2.',
  required: 'This value is required.',
  version: 'Keres Server {{version}}',
  fatal: 'Could not start: {{message}}',
} as const;

export const pt: Record<keyof typeof en, string> = {
  help: `Keres Server — sobe a API Keres sem Docker.

Uso:
  keres-server                 Inicia (assistente na primeira vez)
  keres-server --setup         Corre o assistente outra vez
  keres-server --config PATH   Usa este config.json
  keres-server --non-interactive
                               Falha se não houver config (sem perguntas)
  keres-server --help
  keres-server --version`,
  language_title: 'Idioma / Language',
  language_en: 'English',
  language_pt: 'Português',
  database_title: 'Banco de dados',
  database_sqlite: 'SQLite — ficheiro neste computador, sem software extra (recomendado)',
  database_postgres: 'PostgreSQL — já tem um servidor',
  postgres_url_prompt: 'URL do PostgreSQL (postgres://user:pass@host:5432/dbname)',
  postgres_needed: 'O PostgreSQL precisa já estar a correr. Este programa não o instala.',
  storage_title: 'Armazenamento de mídia',
  storage_local: 'Pasta neste computador (recomendado)',
  storage_s3: 'Amazon S3 ou compatível',
  s3_bucket: 'Bucket S3',
  s3_access_key: 'S3 access key id',
  s3_secret: 'S3 secret access key',
  s3_region: 'Região S3',
  s3_endpoint: 'Endpoint S3 (vazio = AWS)',
  port_prompt: 'Porta HTTP',
  bind_title: 'Quem pode ligar',
  bind_localhost: 'Só este computador (127.0.0.1)',
  bind_lan: 'Aparelhos na rede local (0.0.0.0)',
  bind_lan_note: 'A rede local não tem HTTPS. Use só numa rede em que confia.',
  data_dir_prompt: 'Pasta de dados (banco, mídia, config)',
  admin_user_prompt: 'Utilizador admin',
  admin_password_prompt: 'Senha admin (vazio = gerar uma)',
  default_marker: '(padrão — prima Enter)',
  default_value: 'Padrão — prima Enter: {{value}}',
  choice_prompt: 'Escreva 1 ou 2, ou prima Enter para o padrão:',
  value_prompt: 'Escreva um valor, ou prima Enter para o padrão:',
  input_prompt: '>',
  generated_password: 'Senha admin gerada (mostrada uma vez): {{password}}',
  saved: 'Configuração gravada em {{path}}',
  starting: 'A iniciar o Keres Server…',
  listening: 'API: {{url}}',
  admin: 'Admin: {{url}}',
  swagger: 'Swagger: {{url}}',
  data_dir: 'Dados: {{path}}',
  backup_hint: 'Cópia de segurança: pare o servidor e copie keres.db e media-storage/.',
  lan_addresses: 'Este computador na rede local: {{urls}}',
  lan_none: 'Nenhum IPv4 de rede local encontrado.',
  lan_localhost_note:
    'O servidor só aceita ligações neste computador. Escolha rede local no --setup para o telemóvel ligar.',
  lan_changed: 'Endereço na rede local mudou: {{urls}}',
  stop_hint: 'Ctrl+C para parar.',
  missing_config: 'config.json em falta. Corra uma vez sem --non-interactive, ou passe --config.',
  driver_locked:
    'Esta pasta de dados já usa {{current}}. Trocar de motor de banco não é suportado. Use uma pasta nova.',
  invalid_choice: 'Escreva 1 ou 2.',
  required: 'Este valor é obrigatório.',
  version: 'Keres Server {{version}}',
  fatal: 'Não foi possível iniciar: {{message}}',
};

export type LauncherMessageKey = keyof typeof en;
