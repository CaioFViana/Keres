/** @jest-environment node */
import { cardLayout, cardMode } from '../../src/guides/cardPlacement';

const window = {
  windowWidth: 400,
  windowHeight: 800,
  cardHeight: 220,
  topInset: 24,
  bottomInset: 0,
};
const at = (y: number, height: number, x = 100, width = 200) => ({ x, y, width, height });

describe('cardMode', () => {
  it('rests at the bottom without a target', () => {
    expect(cardMode({ ...window, target: null })).toBe('bottom');
  });

  it('sits below the target while there is room under it', () => {
    expect(cardMode({ ...window, target: at(100, 60) })).toBe('below');
  });

  it('sits above the target when the bottom is too tight, as the last group of a menu', () => {
    expect(cardMode({ ...window, target: at(640, 90) })).toBe('above');
  });

  it('counts the system bar under the card', () => {
    const target = at(480, 40);
    expect(cardMode({ ...window, target })).toBe('below');
    expect(cardMode({ ...window, bottomInset: 80, target })).toBe('above');
  });

  it('rests at the bottom for a target scrolled out of the window, so the card stays readable', () => {
    expect(cardMode({ ...window, target: at(900, 60) })).toBe('bottom');
    expect(cardMode({ ...window, target: at(-200, 60) })).toBe('bottom');
  });

  it('rests on the edge that covers a large target less', () => {
    expect(cardMode({ ...window, target: at(40, 620) })).toBe('bottom');
    expect(cardMode({ ...window, target: at(250, 540) })).toBe('top');
  });
});

describe('cardLayout', () => {
  it('puts the card under the target, with the arrow at the target centre', () => {
    const target = at(100, 60);
    const layout = cardLayout({ ...window, spot: target, target });

    expect(layout.mode).toBe('below');
    expect(layout.top).toBe(100 + 60 + 14);
    expect(layout.width).toBe(360);
    // The target is centred on x=200, the card is 360 wide from x=20: the arrow is at its middle.
    expect(layout.left).toBe(20);
    expect(layout.arrowX).toBe(180);
  });

  it('puts the card over the target when it points down', () => {
    const target = at(640, 90);
    const layout = cardLayout({ ...window, spot: target, target });

    expect(layout.mode).toBe('above');
    expect(layout.top).toBe(640 - 14 - 220);
  });

  it('keeps the card inside the window and the arrow on the card for a target at the edge', () => {
    const target = at(100, 40, 0, 40);
    const layout = cardLayout({ ...window, spot: target, target });

    expect(layout.left).toBe(20);
    expect(layout.arrowX).toBe(28);
    const far = at(100, 40, 360, 40);
    const right = cardLayout({ ...window, spot: far, target: far });
    expect(right.left + right.width).toBe(380);
    expect(right.arrowX).toBe(right.width - 28);
  });

  it('follows the hole as it slides but keeps the side chosen for where it is going', () => {
    const target = at(100, 60);
    const sliding = at(400, 60);
    const layout = cardLayout({ ...window, spot: sliding, target });

    expect(layout.mode).toBe('below');
    expect(layout.top).toBe(400 + 60 + 14);
  });

  it('never leaves the window, even while the hole slides in from far away', () => {
    const target = at(100, 60);
    const far = at(790, 60);
    const layout = cardLayout({ ...window, spot: far, target });

    expect(layout.top).toBe(800 - 0 - 20 - 220);
  });

  it('rests on the bottom edge above the system bar for a step without a target', () => {
    const layout = cardLayout({ ...window, bottomInset: 34, spot: null, target: null });

    expect(layout).toMatchObject({ mode: 'bottom', top: 800 - 34 - 20 - 220, left: 20 });
  });
});
