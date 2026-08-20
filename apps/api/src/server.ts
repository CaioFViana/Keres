import { bootAndListen } from './boot';

// Docker / `bun run start:api`: sem assistente, lê `.env` como sempre.
await bootAndListen();
