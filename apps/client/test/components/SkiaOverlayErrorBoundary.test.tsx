import { render } from '@testing-library/react-native';
import React from 'react';
import { View } from 'react-native';
import SkiaOverlayErrorBoundary from '../../src/components/features/graphs/SkiaEdgeCanvas/SkiaOverlayErrorBoundary';

function markersOf(
  view: { container: { queryAll: (predicate: (node: any) => boolean) => unknown[] } },
  testID: string,
) {
  return view.container.queryAll((node) => node.props?.testID === testID);
}

describe('SkiaOverlayErrorBoundary', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders children normally', async () => {
    const view = await render(
      <SkiaOverlayErrorBoundary canvas="location-map">
        <View testID="child" />
      </SkiaOverlayErrorBoundary>,
    );

    expect(markersOf(view, 'child')).toHaveLength(1);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('blanks only the overlay and logs the failure loudly when a child throws', async () => {
    const failure = new Error('Skia ViewManager missing');
    function Boom(): React.ReactNode {
      throw failure;
    }
    const view = await render(
      <SkiaOverlayErrorBoundary canvas="location-map">
        <View testID="marker" />
        <Boom />
      </SkiaOverlayErrorBoundary>,
    );

    expect(markersOf(view, 'marker')).toHaveLength(0);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[SkiaEdgeCanvas:location-map]'),
      failure,
    );
  });
});
