import AsyncStorage from '@react-native-async-storage/async-storage';

/** What this device accepted of one legal document: which version, when, and where. */
export interface ClientLegalAcceptance {
  version: number;
  /** ISO timestamp of the acceptance. */
  acceptedAt: string;
  /** Where it was accepted: onboarding, settings, or a re-asked update. */
  method: 'onboarding' | 'settings' | 'reaccept';
}

export type ClientLegalDocument = 'terms' | 'privacy';

const KEYS: Record<ClientLegalDocument, string> = {
  terms: '@keres/client-terms/accepted',
  privacy: '@keres/client-privacy/accepted',
};

/** The pre-records key, kept as a fallback: a version alone from before timestamps existed. */
const LEGACY_TERMS_VERSION_KEY = '@keres/client-terms/accepted-version';

function parseAcceptance(raw: string | null): ClientLegalAcceptance | null {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ClientLegalAcceptance>;
    if (typeof parsed.version !== 'number' || !Number.isInteger(parsed.version)) return null;
    if (typeof parsed.acceptedAt !== 'string' || typeof parsed.method !== 'string') return null;
    if (
      parsed.method !== 'onboarding' &&
      parsed.method !== 'settings' &&
      parsed.method !== 'reaccept'
    ) {
      return null;
    }
    return { version: parsed.version, acceptedAt: parsed.acceptedAt, method: parsed.method };
  } catch {
    return null;
  }
}

/**
 * What this device accepted of a document, if anything. Corrupt or missing reads as never
 * accepted - the welcome asks again rather than assuming. A storage read that fails rejects, so
 * the caller can tell 'never accepted' from 'could not tell'.
 */
export async function getAcceptedClientLegal(
  document: ClientLegalDocument,
): Promise<ClientLegalAcceptance | null> {
  const stored = parseAcceptance(await AsyncStorage.getItem(KEYS[document]));
  if (stored) return stored;
  // Fallback for installs that recorded only the terms version, before records existed.
  if (document === 'terms') {
    const raw = await AsyncStorage.getItem(LEGACY_TERMS_VERSION_KEY);
    const version = raw === null ? NaN : Number.parseInt(raw, 10);
    if (Number.isInteger(version)) {
      return { version, acceptedAt: '', method: 'onboarding' };
    }
  }
  return null;
}

export async function setAcceptedClientLegal(
  document: ClientLegalDocument,
  version: number,
  method: ClientLegalAcceptance['method'],
): Promise<void> {
  try {
    const record: ClientLegalAcceptance = {
      version,
      acceptedAt: new Date().toISOString(),
      method,
    };
    await AsyncStorage.setItem(KEYS[document], JSON.stringify(record));
  } catch {
    // Acceptance is a nicety next to the account-level records: a missed write only asks again.
  }
}
