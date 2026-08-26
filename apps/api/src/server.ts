import { bootAndListen } from './boot';

// Docker / `bun run api:start`: no wizard, it reads `.env` as always.
await bootAndListen();
