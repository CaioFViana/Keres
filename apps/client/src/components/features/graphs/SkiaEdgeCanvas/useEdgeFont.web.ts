import { useFont } from '@shopify/react-native-skia';
import type { SkFont } from '@shopify/react-native-skia';
import { Asset } from 'expo-asset';
import { useEffect, useState } from 'react';
import mediumAssetId from '@/assets/fonts/Roboto-Medium.ttf';
import regularAssetId from '@/assets/fonts/Roboto-Regular.ttf';

let warned = false;

/**
 * Web twin: `matchFont` is unimplemented on web (`matchFamilyStyle` throws), so labels
 * use the bundled Roboto (the family Android used before; Regular + Medium cover the
 * historical weights). The URI resolves through `expo-asset` - proven on web, where
 * Skia's own `Platform.resolveAsset` builds hashless URIs - and feeds `useFont` as a
 * plain string, bypassing asset resolution entirely. Null until loaded (callers already
 * skip labels without a font) and null forever if the asset fails, never a throw.
 */
export function useEdgeFont(fontSize: number, medium = false): SkFont | null {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.resolve()
      .then(() => Asset.loadAsync(medium ? mediumAssetId : regularAssetId))
      .then(([asset]) => {
        if (live) setUri(asset?.localUri ?? asset?.uri ?? null);
      })
      .catch((error: unknown) => {
        if (!warned) {
          warned = true;
          console.warn('[SkiaEdgeCanvas] bundled font failed to load; labels stay hidden.', error);
        }
      });
    return () => {
      live = false;
    };
  }, [medium]);

  return useFont(uri, fontSize);
}
