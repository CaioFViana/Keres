import React from 'react';

interface SkiaOverlayErrorBoundaryProps {
  /** Which canvas owns the overlay, so the logged failure names its screen. */
  canvas: string;
  children: React.ReactNode;
}

interface SkiaOverlayErrorBoundaryState {
  failed: boolean;
}

/**
 * Containment for the Skia edges overlay: a Skia-side render failure (a missing native
 * module after a JS-only update, a font the device cannot match, a reconciler error) must
 * blank only the edge lines - never the pins and images on the planes around it. The
 * failure is logged loudly so it still surfaces in logcat/Metro instead of being masked.
 */
class SkiaOverlayErrorBoundary extends React.Component<
  SkiaOverlayErrorBoundaryProps,
  SkiaOverlayErrorBoundaryState
> {
  override state: SkiaOverlayErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): SkiaOverlayErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    console.error(
      `[SkiaEdgeCanvas:${this.props.canvas}] edges overlay failed to render; ` +
        `pins and images stay interactive without the edge lines.`,
      error,
    );
  }

  override render(): React.ReactNode {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

export default SkiaOverlayErrorBoundary;
