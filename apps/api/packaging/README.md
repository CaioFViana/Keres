# Keres Server

**English** · [Português](#português)

Home API server: sync a phone with this PC **without** Docker and **without** PostgreSQL. Run `keres-server.exe` (Windows) or `keres-server` (Linux/macOS). The first launch asks for language, database (SQLite by default), and whether to listen on this computer only or on the local network.

Data does **not** live in this program folder. Replacing the zip does not delete stories.

| System | Data folder |
| --- | --- |
| Windows | `%APPDATA%\KeresServer` |
| macOS | `~/Library/Application Support/KeresServer` |
| Linux | `~/.local/share/keres-server` |

The CLI prints the LAN address (`http://192.168.x.x:<port>`). There is no `.local` hostname. `Ctrl+C` stops the server.

## Backups (do this)

**At least once a month.** More often if you write every day. A lost server here is not recovered by the client app: exporting a story does **not** replace a server backup (accounts, permissions, friends, and media stay behind).

1. Stop Keres Server (`Ctrl+C`). Do not copy while it is running.
2. In this program folder, run:

   ```text
   keres-server --backup
   ```

   (Windows: `keres-server.exe --backup`.) Optional: `keres-server --backup D:\Backups` to choose the parent folder.
3. A folder named with the date and time is created, by default next to the live data (`KeresServer-backups\2026-08-20_15-30-45` on Windows). It contains `keres.db`, `-wal`/`-shm` files if present, `media-storage/`, `config.json`, and `secrets.json`.
4. Start Keres Server again as usual.
5. Copy that dated folder to another disk (USB drive, cloud). `--backup` does not upload anything off this computer.

### If the worst happens

Stop the server. Open the data folder from the table above and the dated backup folder. Delete (or rename) the current contents of the data folder and copy **everything** from the dated folder into it. Start the program again. Do not mix files from backups taken on different days.

If you chose PostgreSQL or S3 in the wizard, `--backup` only copies what is still on this machine. Postgres dumps and the bucket lifecycle belong to whoever runs that server.

---

<a id="português"></a>

# Keres Server

Servidor da API Keres para uso em casa: sincronizar o telemóvel com o PC **sem** Docker e **sem** PostgreSQL. Execute `keres-server.exe` (Windows) ou `keres-server` (Linux/macOS). Na primeira vez, um assistente pede o idioma, o banco (SQLite por omissão) e se o servidor escuta só neste computador ou na rede local.

Os dados **não** ficam nesta pasta do programa. Atualizar o zip não apaga histórias.

| Sistema | Pasta de dados |
| --- | --- |
| Windows | `%APPDATA%\KeresServer` |
| macOS | `~/Library/Application Support/KeresServer` |
| Linux | `~/.local/share/keres-server` |

O CLI mostra o endereço na rede local (`http://192.168.x.x:<porta>`). Não há nome `.local`. `Ctrl+C` para parar.

## Cópia de segurança (faça isto)

**No mínimo uma vez por mês.** Mais vezes se escreve todos os dias. Uma história perdida aqui não volta pelo cliente: a exportação de uma história no aplicativo **não** substitui o backup do servidor (contas, permissões, amigos e mídias ficam de fora).

1. Pare o Keres Server (`Ctrl+C`). Não copie com ele a correr.
2. Na pasta deste programa, execute:

   ```text
   keres-server --backup
   ```

   (Windows: `keres-server.exe --backup`.) Opcional: `keres-server --backup D:\Backups` para escolher a pasta-mãe.
3. É criada uma pasta com data e hora, por omissão ao lado dos dados (`KeresServer-backups\2026-08-20_15-30-45` no Windows). Lá entram `keres.db`, ficheiros `-wal`/`-shm` se existirem, `media-storage/`, `config.json` e `secrets.json`.
4. Volte a abrir o Keres Server normalmente.
5. Copie essa pasta datada para outro disco (pendrive, nuvem). O `--backup` não envia nada para fora deste computador.

### Se o pior acontecer

Pare o servidor. Abra a pasta de dados da tabela acima e a pasta datada do backup. Apague (ou renomeie) o conteúdo atual da pasta de dados e copie para lá **tudo** o que está na pasta datada. Volte a executar o programa. Não misture ficheiros de backups de dias diferentes.

Se escolheu PostgreSQL ou S3 no assistente, o `--backup` só copia o que ainda está nesta máquina. O dump do Postgres e o ciclo de vida do bucket são da pessoa que gere esse servidor.
