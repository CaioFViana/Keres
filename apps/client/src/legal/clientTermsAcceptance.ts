import AsyncStorage from '@react-native-async-storage/async-storage';

/** The client terms version accepted on this device, if any. */
const ACCEPTED_VERSION_KEY = '@keres/client-terms/accepted-version';

/**
 * Which client terms the person agreed to, if they did. Corrupt or missing reads as never
 * agreed - the welcome asks again rather than assuming.
 */
export async function getAcceptedClientTermsVersion(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(ACCEPTED_VERSION_KEY);
    const version = raw === null ? NaN : Number.parseInt(raw, 10);
    return Number.isInteger(version) ? version : null;
  } catch {
    return null;
  }
}

export async function setAcceptedClientTermsVersion(version: number): Promise<void> {
  try {
    await AsyncStorage.setItem(ACCEPTED_VERSION_KEY, String(version));
  } catch {
    // Acceptance is a nicety next to the account-level records: a missed write only asks again.
  }
}
