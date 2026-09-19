import { render } from '@testing-library/react-native';
import React from 'react';
import { Dimensions } from 'react-native';
import GuideSpotlight, {
  roundedRectSvg,
  SPOTLIGHT_RADIUS,
  spotlightDimSvg,
} from '../../src/components/common/feedback/GuideHost/GuideSpotlight';

const RECT = { x: 10, y: 100, width: 200, height: 40 };

let mockReady = true;
jest.mock('../../src/components/features/graphs/SkiaEdgeCanvas/useCanvasKitReady', () => ({
  __esModule: true,
  useCanvasKitReady: () => mockReady,
}));

beforeEach(() => {
  mockReady = true;
});

describe('roundedRectSvg', () => {
  it('draws the four corners clockwise from the top edge', () => {
    expect(roundedRectSvg(RECT, 8)).toBe(
      'M18 100H202Q210 100 210 108V132Q210 140 202 140H18Q10 140 10 132V108Q10 100 18 100Z',
    );
  });

  it('clamps the radius to half the smallest side', () => {
    expect(roundedRectSvg({ x: 0, y: 0, width: 10, height: 6 }, 8)).toBe(
      'M3 0H7Q10 0 10 3V3Q10 6 7 6H3Q0 6 0 3V3Q0 0 3 0Z',
    );
  });
});

describe('GuideSpotlight', () => {
  it('punches the rounded hole and strokes the matching border from one canvas', async () => {
    const screen = await render(<GuideSpotlight rect={RECT} borderColor="#00f" />);
    const { width, height } = Dimensions.get('window');

    expect(screen.getByTestId('guide-spotlight')).toBeTruthy();
    const paths = screen.container.queryAll((node) => node.type === 'SkiaPath');
    expect(paths).toHaveLength(2);
    expect(paths[0].props).toMatchObject({
      path: spotlightDimSvg(width, height, RECT, SPOTLIGHT_RADIUS),
      fillType: 'evenOdd',
      color: 'rgba(0, 0, 0, 0.6)',
    });
    expect(paths[1].props).toMatchObject({
      path: roundedRectSvg(
        { x: RECT.x + 1, y: RECT.y + 1, width: RECT.width - 2, height: RECT.height - 2 },
        SPOTLIGHT_RADIUS - 1,
      ),
      style: 'stroke',
      strokeWidth: 2,
      color: '#00f',
    });
  });

  it('falls back to square legacy views before CanvasKit is ready', async () => {
    mockReady = false;
    const screen = await render(<GuideSpotlight rect={RECT} borderColor="#00f" />);

    expect(screen.container.queryAll((node) => node.type === 'SkiaCanvas')).toHaveLength(0);
    const border = screen.getByTestId('guide-spotlight');
    expect(border).toBeTruthy();
    expect(border.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ borderWidth: 2 })]),
    );
  });
});
