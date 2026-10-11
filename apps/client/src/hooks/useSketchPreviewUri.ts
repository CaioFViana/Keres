import { useEffect, useMemo, useRef, useState } from 'react';
import { useResolvedMediaUri } from './useResolvedMediaUri';
import {
  createSketchPreviewService,
  sketchPreviewKey,
  type SketchPreviewLook,
} from '../services/storymanagement/SketchPreviewService';
import { useTheme, type ThemeColors } from '../theme';

/** The look a display preview is drawn with: what the canvas shows under this theme. */
export function sketchLookFromTheme(colors: ThemeColors): SketchPreviewLook {
  return {
    colors: {
      background: colors.background,
      surface: colors.surface,
      text: colors.text,
      textSecondary: colors.textSecondary,
      border: colors.border,
      primary: colors.primary,
    },
    paper: colors.surface,
  };
}

export interface SketchPreviewSource {
  name: string;
  content: unknown;
}

/** One render per drawing+look however many rows ask at once. */
const inflight = new Map<string, Promise<string | null>>();

function previewKeyOf(content: unknown, look: SketchPreviewLook): string | null {
  try {
    return sketchPreviewKey(content as never, look);
  } catch {
    // Corrupt content has no preview; the caller shows the icon.
    return null;
  }
}

/**
 * The cached preview of a sketch under the current theme, drawing it in the background when
 * missing. `null` while resolving or when it cannot be drawn: the caller shows the icon.
 * Nothing here touches the Gallery; every device draws its own previews.
 */
export function useSketchPreviewUri(sketch: SketchPreviewSource | null | undefined): string | null {
  const { colors } = useTheme();
  const look = useMemo(() => sketchLookFromTheme(colors), [colors]);
  const key = useMemo(
    () => (sketch ? previewKeyOf(sketch.content, look) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the look is rebuilt per theme; its fields are the dep.
    [sketch, look.colors.background, look.colors.surface, look.colors.text, look.colors.textSecondary, look.colors.border, look.colors.primary, look.paper],
  );
  const [raw, setRaw] = useState<string | null>(null);
  const keyRef = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    // A reload hands new row objects for the same drawing: keep showing it while re-resolving.
    if (key !== keyRef.current) {
      keyRef.current = key;
      setRaw(null);
    }
    if (!sketch || !key) return;
    const { name, content } = sketch;
    const run = inflight.get(key) ?? (() => {
      const work = createSketchPreviewService()
        .ensure(name, content as never, look)
        .then((made) => made.uri)
        .catch((error) => {
          console.log('useSketchPreviewUri: could not draw a sketch preview.', error);
          return null;
        })
        .finally(() => {
          if (inflight.get(key) === work) inflight.delete(key);
        });
      inflight.set(key, work);
      return work;
    })();
    void run.then((uri) => {
      if (alive) setRaw(uri);
    });
    return () => {
      alive = false;
    };
  }, [key, sketch, look]);

  return useResolvedMediaUri(raw);
}
