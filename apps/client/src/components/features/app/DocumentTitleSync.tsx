import { useEffect } from 'react';
import { setDocumentTitle } from '../../../utils/documentTitle';

/**
 * Sets the initial `document.title` before any screen has focused yet (e.g. during the
 * cold-install wizard, which sets no title of its own).
 *
 * Every screen that has a title to show calls `setDocumentTitle` itself, directly, from the
 * same focus effect that already sets its in-app header title (see
 * `apps/client/src/utils/documentTitle.ts`) - this component does NOT try to derive titles from
 * React Navigation's `getCurrentOptions()`/`'options'` event.
 *
 * That was tried first and reverted: `getCurrentOptions()` resolves the *deepest focused leaf's
 * own* options, but every list/detail/form screen in this app sets its title one level up (on
 * the Drawer, via `navigation.getParent()?.setOptions()`) - correct for the visible in-app
 * header, but invisible to `getCurrentOptions()`, which always saw it as empty there. Beyond
 * that, the fix required subscribing to the container's `'options'` event as this component's
 * OWN `useEffect` - with no reactive dependency tying it to navigation state, that subscription
 * doesn't get refreshed the way React Navigation's own internal `useDocumentTitle` hook
 * refreshes its (every render, deliberately - the underlying getter chain it targets can go
 * stale across navigation). The result was a title that could flash correct then revert, or
 * that got stuck on a previous screen's value after a stack reset (e.g. drawer-navigating back
 * to a list screen after visiting its edit form) - exactly the class of bug direct, explicit
 * per-screen calls avoid entirely, since there's no separate listener left that can race them.
 *
 * A no-op on native (Android/iOS): `document` doesn't exist there, and there's no equivalent
 * OS-level title to drive without native code.
 */
const DocumentTitleSync = () => {
  useEffect(() => {
    setDocumentTitle('');
  }, []);

  return null;
};

export default DocumentTitleSync;
