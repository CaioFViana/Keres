/**
 * The thread: one line that runs through a page like the map of a branching story.
 *
 * This file is the same in `apps/site` and `apps/web` (the two apps share no package, so the copy is kept
 * identical by a test on each side). It reads markers the page carries and draws one SVG under the content:
 *
 *   [data-thread-origin]   where the thread starts; `data-ox` / `data-oy` are fractions of the element's box
 *   [data-thread-knot]     a heading the thread passes through; `data-thread-tint` colours its node and
 *                          `data-thread-branching` adds a small fork to it
 *   [data-thread-fork]     a group of [data-thread-branch] children: the thread splits to each and gathers again
 *   [data-thread-end]      where the thread is cut
 *
 * Wide screens spread a fork into columns (the strands fan out and in); narrow ones stack the branches, and the
 * thread stays on the rail, sending a short elbow to each. What the reader has passed is drawn solid and the rest
 * as a dashed thread not yet spun. The rail's place is the `--thread-rail` custom property of the frame.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const NARROW = '(max-width: 760px)';

interface Part {
  d: string;
  from: number;
  to: number;
  lit?: SVGPathElement;
}

interface Dot {
  x: number;
  y: number;
  radius: number;
  tint: string | null;
  small: boolean;
  el?: SVGCircleElement;
}

export interface Thread {
  /** Draws again: the page changed in a way the thread cannot see on its own. */
  refresh(): void;
  destroy(): void;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function append<K extends 'path' | 'circle'>(
  svg: SVGSVGElement,
  tag: K,
  attributes: Record<string, string | number>,
  className: string,
) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  element.setAttribute('class', className);
  svg.append(element);
  return element;
}

/**
 * Draws the thread of `frame` into `svg`, from the markers inside `content`, and keeps it drawn: it follows the
 * page's size, what changes inside it and the scroll.
 */
export function createThread(frame: HTMLElement, svg: SVGSVGElement, content: HTMLElement): Thread {
  let parts: Part[] = [];
  let dots: Dot[] = [];
  let frameId = 0;
  const reduced = prefersReducedMotion();

  function build() {
    const box = frame.getBoundingClientRect();
    const rel = (element: Element) => {
      const r = element.getBoundingClientRect();
      return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height };
    };
    /** The middle of a heading's first line: where its knot sits. */
    const knotY = (element: Element) => {
      const r = rel(element);
      const style = getComputedStyle(element);
      const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2 || 0;
      return r.y + Math.min(lineHeight, r.h) / 2;
    };
    const rail = parseFloat(getComputedStyle(frame).getPropertyValue('--thread-rail')) || 0;
    const narrow = typeof window.matchMedia === 'function' && window.matchMedia(NARROW).matches;
    const bow = narrow ? 3 : 7;

    parts = [];
    dots = [];
    let flip = 1;
    let current: number | null = null;

    const part = (d: string, from: number, to: number) => parts.push({ d, from, to });
    /** A stretch of the rail with a slight bow, so the thread does not look ruled. */
    const stretch = (from: number, to: number) => {
      if (current === null || to - from < 2) return;
      const b = bow * flip;
      flip = -flip;
      const k = (to - from) / 3;
      part(
        `M${rail},${from} C${rail + b},${from + k} ${rail - b},${from + 2 * k} ${rail},${to}`,
        from,
        to,
      );
    };
    const dotAt = (x: number, y: number, radius: number, tint: string | null, small: boolean) =>
      dots.push({ x, y, radius, tint, small });

    const markers = content.querySelectorAll(
      '[data-thread-origin],[data-thread-knot],[data-thread-fork],[data-thread-end]',
    );
    for (const element of markers) {
      if (element.hasAttribute('data-thread-origin')) {
        const r = rel(element);
        const startY = r.y + parseFloat((element as HTMLElement).dataset.oy ?? '1') * r.h;
        const startX = r.x + parseFloat((element as HTMLElement).dataset.ox ?? '0.5') * r.w;
        // From the emblem's hair to the rail, in a short fall.
        part(
          `M${startX},${startY} C${startX},${startY + 18} ${rail},${startY + 6} ${rail},${startY + 30}`,
          startY,
          startY + 30,
        );
        current = startY + 30;
      } else if (element.hasAttribute('data-thread-knot')) {
        const y = knotY(element);
        stretch(current ?? y, y);
        dotAt(rail, y, narrow ? 6 : 7, (element as HTMLElement).dataset.threadTint ?? null, false);
        if (element.hasAttribute('data-thread-branching')) {
          part(
            `M${rail},${y} C${rail + 12},${y} ${rail + 10},${y - 9} ${rail + 24},${y - 9}`,
            y - 9,
            y,
          );
          part(
            `M${rail},${y} C${rail + 12},${y} ${rail + 10},${y + 9} ${rail + 24},${y + 9}`,
            y,
            y + 9,
          );
        }
        current = y;
      } else if (element.hasAttribute('data-thread-fork')) {
        const f = rel(element);
        const entry = f.y + (narrow ? 6 : 12);
        const join = f.y + f.h - (narrow ? 6 : 12);
        stretch(current ?? entry, entry);
        dotAt(rail, entry, 4.5, null, true);
        const branches = [...element.querySelectorAll('[data-thread-branch]')];
        if (branches.length > 0) {
          const first = rel(branches[0] as Element);
          const sameRow = (branch: Element) => Math.abs(rel(branch).y - first.y) < 4;
          if (branches.length > 1 && branches.every(sameRow)) {
            for (const branch of branches) {
              const r = rel(branch);
              const cx = r.x + r.w / 2;
              const bottom = r.y + r.h;
              const g1 = (r.y - entry) * 0.72;
              const g2 = (join - bottom) * 0.72;
              part(
                `M${rail},${entry} C${rail},${entry + g1} ${cx},${r.y - g1} ${cx},${r.y}`,
                entry,
                r.y,
              );
              part(
                `M${cx},${bottom} C${cx},${bottom + g2} ${rail},${join - g2} ${rail},${join}`,
                bottom,
                join,
              );
              dotAt(cx, r.y, 4.5, null, true);
              dotAt(cx, bottom, 4.5, null, true);
            }
          } else {
            stretch(entry, join);
            for (const branch of branches) {
              const r = rel(branch);
              const y = knotY(branch.querySelector('[data-thread-title]') ?? branch);
              part(`M${rail},${y - 18} Q${rail},${y} ${rail + 18},${y} H${r.x}`, y - 18, y);
              dotAt(r.x, y, 4, null, true);
            }
          }
        }
        dotAt(rail, join, 4.5, null, true);
        current = join;
      } else if (element.hasAttribute('data-thread-end')) {
        const y = knotY(element);
        stretch(current ?? y, y);
        dotAt(rail, y, narrow ? 6 : 7, null, false);
        // The cut: the thread stops, and two frayed ends hang from it.
        part(
          `M${rail},${y} C${rail + 2},${y + 12} ${rail - 7},${y + 17} ${rail - 11},${y + 30}`,
          y,
          y + 30,
        );
        part(
          `M${rail},${y} C${rail - 1},${y + 10} ${rail + 8},${y + 18} ${rail + 12},${y + 26}`,
          y,
          y + 26,
        );
        current = y;
      }
    }

    svg.replaceChildren();
    svg.setAttribute('width', String(box.width));
    svg.setAttribute('height', String(box.height));
    for (const p of parts) {
      append(svg, 'path', { d: p.d }, 'thread-base');
      p.lit = append(svg, 'path', { d: p.d, pathLength: 1 }, 'thread-lit');
    }
    for (const d of dots) {
      d.el = append(
        svg,
        'circle',
        { cx: d.x, cy: d.y, r: d.radius },
        d.small ? 'thread-dot is-small' : 'thread-dot',
      );
      if (d.tint) d.el.style.setProperty('--tint', d.tint);
    }
    paint();
  }

  /** How much of the thread the reader has passed: everything above a line a little below the middle of the window. */
  function paint() {
    const mark = reduced
      ? Number.POSITIVE_INFINITY
      : window.innerHeight * 0.62 - frame.getBoundingClientRect().top;
    for (const p of parts) {
      p.lit?.style.setProperty(
        'stroke-dashoffset',
        String(1 - clamp((mark - p.from) / Math.max(p.to - p.from, 1))),
      );
    }
    for (const d of dots) d.el?.classList.toggle('is-on', mark >= d.y);
  }

  const later = (work: () => void) => () => {
    if (frameId) return;
    frameId = window.requestAnimationFrame(() => {
      frameId = 0;
      work();
    });
  };
  const rebuild = later(build);
  const repaint = later(paint);

  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(rebuild) : null;
  resize?.observe(frame);
  // What changes inside the page without changing its size: a list that fills in, a section that opens.
  const mutations = new MutationObserver(rebuild);
  mutations.observe(content, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['open', 'hidden', 'class'],
  });
  window.addEventListener('scroll', repaint, { passive: true });
  window.addEventListener('resize', rebuild);
  void document.fonts?.ready.then(rebuild);
  build();

  return {
    refresh: rebuild,
    destroy() {
      resize?.disconnect();
      mutations.disconnect();
      window.removeEventListener('scroll', repaint);
      window.removeEventListener('resize', rebuild);
      if (frameId) window.cancelAnimationFrame(frameId);
    },
  };
}
