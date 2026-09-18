import { act, render } from '@testing-library/react-native';
import * as SkiaMock from '@shopify/react-native-skia';
import { Asset } from 'expo-asset';
import React from 'react';
import { View } from 'react-native';
import mediumTtf from '../../assets/fonts/Roboto-Medium.ttf';
import regularTtf from '../../assets/fonts/Roboto-Regular.ttf';
import { useEdgeFont } from '../../src/components/features/graphs/SkiaEdgeCanvas/useEdgeFont.web';

jest.mock('expo-asset', () => ({
  Asset: { loadAsync: () => Promise.resolve([]) },
}));

function Probe({ size, medium }: { size: number; medium?: boolean }) {
  const font = useEdgeFont(size, medium);
  return React.createElement(View, { testID: font ? 'loaded' : 'pending' });
}

function markersOf(view: { container: { queryAll: (predicate: (node: any) => boolean) => unknown[] } }, testID: string) {
  return view.container.queryAll((node) => node.props?.testID === testID);
}

describe('useEdgeFont.web', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('hands the Medium asset URI to useFont with the size', async () => {
    let resolveLoad!: (value: never) => void;
    const gate = new Promise<never>((resolve) => {
      resolveLoad = resolve;
    });
    jest.spyOn(Asset, 'loadAsync').mockReturnValue(gate);
    const useFontSpy = jest.spyOn(SkiaMock, 'useFont');

    const view = await render(React.createElement(Probe, { size: 11, medium: true }));
    expect(Asset.loadAsync).toHaveBeenCalledWith(mediumTtf);
    await act(async () => {
      resolveLoad([{ localUri: 'http://x/Roboto-Medium.ttf', uri: 'http://x/Roboto-Medium.ttf' }] as never);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(useFontSpy).toHaveBeenCalledWith('http://x/Roboto-Medium.ttf', 11);
    expect(markersOf(view, 'loaded')).toHaveLength(1);
  });

  it('hands the Regular asset URI to useFont when medium is off', async () => {
    let resolveLoad!: (value: never) => void;
    const gate = new Promise<never>((resolve) => {
      resolveLoad = resolve;
    });
    jest.spyOn(Asset, 'loadAsync').mockReturnValue(gate);
    const useFontSpy = jest.spyOn(SkiaMock, 'useFont');

    const view = await render(React.createElement(Probe, { size: 10 }));
    expect(Asset.loadAsync).toHaveBeenCalledWith(regularTtf);
    await act(async () => {
      resolveLoad([{ localUri: 'http://x/Roboto-Regular.ttf', uri: 'http://x/Roboto-Regular.ttf' }] as never);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(useFontSpy).toHaveBeenCalledWith('http://x/Roboto-Regular.ttf', 10);
    expect(markersOf(view, 'loaded')).toHaveLength(1);
  });

  it('stays pending and warns once when the asset fails to load', async () => {
    let rejectLoad!: (reason: unknown) => void;
    const gate = new Promise<never>((_, reject) => {
      rejectLoad = reject;
    });
    jest.spyOn(Asset, 'loadAsync').mockReturnValue(gate);
    jest.spyOn(SkiaMock, 'useFont').mockReturnValue(null);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const view = await render(React.createElement(Probe, { size: 10 }));
    await act(async () => {
      rejectLoad(new Error('offline'));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(markersOf(view, 'pending')).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('bundled font'),
      expect.any(Error),
    );
  });
});
