import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { describe, expect, it } from 'vitest';
import type { CompatibleDb } from '../../src/db';

describe('CompatibleDb brand', () => {
  it('rejects assigning a raw Postgres handle without the adapter bridge', () => {
    // Compile-time gate: if CompatibleDb loses its brand, this Assignable becomes true
    // and the const below fails to type-check.
    type RawPg = NodePgDatabase<Record<string, never>>;
    type Assignable = RawPg extends CompatibleDb ? true : false;
    const rawIsNotCompatible: Assignable extends false ? true : false = true;
    expect(rawIsNotCompatible).toBe(true);
  });

  it('keeps a symbol brand key on the application contract', () => {
    type HasBrandSymbol = Extract<keyof CompatibleDb, symbol> extends never ? false : true;
    const branded: HasBrandSymbol = true;
    expect(branded).toBe(true);
  });
});
