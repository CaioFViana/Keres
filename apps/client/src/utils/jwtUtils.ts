// apps/client/src/utils/jwtUtils.ts

interface DecodedJwt {
  exp: number; // Expiration time as Unix timestamp (seconds since epoch)
  [key: string]: any; // Other claims
}

/**
 * Decodes a JWT and returns its payload.
 * @param token The JWT string.
 * @returns The decoded payload, or null if decoding fails.
 */
export const decodeJwt = (token: string): DecodedJwt | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('Invalid JWT format: token must have 3 parts.');
      return null;
    }
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

/**
 * Checks if a JWT is expired.
 * @param token The JWT string.
 * @param gracePeriodSeconds Optional grace period in seconds before actual expiration.
 * @returns True if the token is expired (or will expire within the grace period), false otherwise.
 */
export const isJwtExpired = (token: string, gracePeriodSeconds: number = 60): boolean => {
  const decoded = decodeJwt(token);
  if (!decoded || typeof decoded.exp !== 'number') {
    // If we can't decode or there's no expiration, assume it's valid for now
    // or handle as an error case depending on strictness. Here, we'll treat it as not expired to avoid false negatives.
    console.warn('Could not determine JWT expiration. Assuming not expired.');
    return false;
  }

  const now = Math.floor(Date.now() / 1000); // Current time in seconds since epoch
  return decoded.exp < now + gracePeriodSeconds;
};
