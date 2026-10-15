/**
 * The name a person gave Keres to call them on this device: what they typed, without the spaces
 * around it, or `null` when nothing is left.
 *
 * It is only a display name - not a login, not the server account's username - so nothing bounds it
 * but being there: `client_settings.local_username` is `NOT NULL` text, and no schema limits it.
 * First-run setup and the settings screen both go through this, so the rule is one.
 */
export function normalizeLocalUsername(raw: string): string | null {
  const name = raw.trim();
  return name.length > 0 ? name : null;
}
