import { bootAndListen } from './boot';

// Docker / `bun run api:start`: sem assistente, lê `.env` como sempre.
await bootAndListen();
