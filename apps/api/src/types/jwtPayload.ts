/**
 * What the API signs into a session token and reads back on every request (the user decorator). Kept out of
 * index.ts so the route modules can name the type without importing the application entry point.
 */
export interface JWTPayload {
  userId: string;
  username: string;
  /**
   * Set while the account is not active in age verification: the session can only reach the verification routes
   * (see `services/ageVerification/pendingAccess.ts`). Absent on every ordinary session.
   */
  pending?: true;
}
