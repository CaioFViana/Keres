import {
  buildPresenceMatrixLayout,
  MATRIX_THREAD_GAP_DASH,
  type PresenceMatrixRow,
} from '@keres/shared/graphs/presenceMatrixLayout';
import { renderPresenceMatrixSvg } from '@keres/shared/graphs/presenceMatrixSvg';

const scene = (id: string) => ({
  id,
  name: `Cena ${id}`,
  chapterName: 'Capítulo',
  chapterColor: '#123456',
});

const row = (sceneIds: string[]): PresenceMatrixRow => ({
  id: 'plot-1',
  label: 'Trama principal',
  color: '#0B6E99',
  cells: new Map(sceneIds.map((id) => [id, 'nota'])),
});

const options = {
  title: 'A Queda',
  subtitle: 'Matriz de tramas',
  background: '#ffffff',
  surface: '#f2f2f2',
  text: '#111111',
  border: '#cccccc',
  showRowCoverage: true,
};

const layoutOf = (sceneCount: number, present: string[]) =>
  buildPresenceMatrixLayout(
    Array.from({ length: sceneCount }, (_, index) => scene(`${index}`)),
    [row(present)],
  );

describe('presence matrix svg', () => {
  it('exports the same thread the screen draws, dashed over the scenes the series skips', () => {
    const svg = renderPresenceMatrixSvg(layoutOf(5, ['0', '3', '4']), options);
    const lines = svg.match(/<line [^>]*\/>/g) ?? [];

    expect(lines).toHaveLength(2);
    expect(lines.filter((line) => line.includes(MATRIX_THREAD_GAP_DASH))).toHaveLength(1);
    expect(lines.every((line) => line.includes('stroke="#0B6E99"'))).toBe(true);
  });

  it('puts the thread under the cells so it never covers a note', () => {
    const svg = renderPresenceMatrixSvg(layoutOf(3, ['0', '1']), options);

    expect(svg.indexOf('<line ')).toBeLessThan(svg.indexOf('nota'));
  });

  it('leaves out the thread when the series appears at most once', () => {
    expect(renderPresenceMatrixSvg(layoutOf(4, ['2']), options)).not.toContain('<line ');
  });
});
