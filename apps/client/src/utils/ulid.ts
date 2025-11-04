import { ulid } from 'ulid';

// The ulid() function uses Math.random internally by default.
// If a custom random number generator is needed, the ulid package
// might have a different API for it, or it might not be directly configurable
// in this manner. For now, we'll use the default.

export { ulid };