import type { PageRoute } from '../routes';
import { reviewRoute } from './review/reviewRoute';
import { uploadRoute } from './upload/uploadRoute';

/**
 * The pages the service serves beside the protocol, in the order they are tried: the person's upload page first, then
 * the reviewers' pages. `createState` mounts these unless a test passes its own.
 */
export const PAGE_ROUTES: readonly PageRoute[] = [uploadRoute, reviewRoute];
