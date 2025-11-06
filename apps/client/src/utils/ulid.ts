import { ulid } from 'ulid';

export function createULID(): string {
  // Explicitly provide Math.random as the PRNG to avoid ULIDError in environments
  // where crypto.getRandomValues might not be reliably available or detected.
  return ulid(Date.now(), Math.random);
}