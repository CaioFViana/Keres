/**
 * @jest-environment node
 */
jest.mock('react-native', () => ({ __esModule: true, useWindowDimensions: jest.fn() }));

import { renderHook } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';
import {
  getResponsiveBreakpoint,
  RESPONSIVE_BREAKPOINTS,
  useResponsiveLayout,
} from '../../src/hooks/useResponsiveLayout';

const dimensions = useWindowDimensions as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getResponsiveBreakpoint', () => {
  it.each([
    [0, 'compact'],
    [767, 'compact'],
    [768, 'medium'],
    [1099, 'medium'],
    [1100, 'wide'],
    [3000, 'wide'],
  ])('classifies %spx as %s', (width, expected) => {
    expect(getResponsiveBreakpoint(width)).toBe(expected);
  });

  it('switches exactly at the declared breakpoints', () => {
    expect(getResponsiveBreakpoint(RESPONSIVE_BREAKPOINTS.medium - 1)).toBe('compact');
    expect(getResponsiveBreakpoint(RESPONSIVE_BREAKPOINTS.medium)).toBe('medium');
    expect(getResponsiveBreakpoint(RESPONSIVE_BREAKPOINTS.wide - 1)).toBe('medium');
    expect(getResponsiveBreakpoint(RESPONSIVE_BREAKPOINTS.wide)).toBe('wide');
  });
});

describe('useResponsiveLayout', () => {
  it.each([
    [400, { isCompact: true, isMedium: false, isWide: false }],
    [900, { isCompact: false, isMedium: true, isWide: false }],
    [1400, { isCompact: false, isMedium: false, isWide: true }],
  ])('reports the flags for %spx', async (width, flags) => {
    dimensions.mockReturnValue({ width, height: 800 });

    const { result } = await renderHook(() => useResponsiveLayout());

    expect(result.current).toMatchObject(flags);
  });

  it('passes the raw dimensions through', async () => {
    dimensions.mockReturnValue({ width: 1024, height: 768 });

    const { result } = await renderHook(() => useResponsiveLayout());

    expect(result.current).toMatchObject({ width: 1024, height: 768, breakpoint: 'medium' });
  });

  it('classifies by width alone, ignoring a tall narrow window', async () => {
    dimensions.mockReturnValue({ width: 400, height: 2000 });

    const { result } = await renderHook(() => useResponsiveLayout());

    expect(result.current.breakpoint).toBe('compact');
  });

  it('never reports two breakpoints at once', async () => {
    dimensions.mockReturnValue({ width: 768, height: 800 });

    const { result } = await renderHook(() => useResponsiveLayout());

    const { isCompact, isMedium, isWide } = result.current;
    expect([isCompact, isMedium, isWide].filter(Boolean)).toHaveLength(1);
  });
});
