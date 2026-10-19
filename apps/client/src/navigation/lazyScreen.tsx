import { type ComponentType, lazy, Suspense } from 'react';
import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';

/**
 * A navigator screen whose code loads the first time it is opened, not when the app starts. The module has to be
 * reached only through this call (a static `import` of it anywhere else keeps it in the first bundle). While the
 * chunk loads, the screen shows the loading state every other screen uses.
 */
export function lazyScreen<Props extends object>(
  load: () => Promise<{ default: ComponentType<Props> }>,
): ComponentType<Props> {
  const Lazy = lazy(load);
  const LazyScreen = (props: Props) => (
    <Suspense fallback={<ScreenLoading />}>
      <Lazy {...props} />
    </Suspense>
  );
  LazyScreen.displayName = 'LazyScreen';
  return LazyScreen;
}
