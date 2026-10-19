/**
 * Plain constants of the messaging system. Kept free of zod so the admin panel can import them
 * (by subpath) without pulling the validation library into its bundle.
 */

/** Longest message between users, or from a user to the administrators. */
export const MESSAGE_BODY_MAX_LENGTH = 2000;

/**
 * How many messages anyone may send to the administrators in 24 hours. The same for every plan -
 * it exists to stop abuse of the contact channel, not to sell anything - and higher than what most
 * plans give for messages between users.
 */
export const ADMIN_MESSAGES_PER_DAY = 30;

/** Largest page of a conversation the API serves at once. */
export const MESSAGE_PAGE_SIZE_MAX = 50;

/**
 * Where a message came from and went to:
 *  - `site`: a visitor wrote it in the landing page form, without an account;
 *  - `admin`: a conversation between one user and the administrators, in either direction;
 *  - `direct`: between two users who are friends.
 */
export const MESSAGE_CHANNELS = ['site', 'admin', 'direct'] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];
