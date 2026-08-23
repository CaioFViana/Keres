import {
  MATRIX_HEADER_HEIGHT,
  MATRIX_LABEL_WIDTH,
  MATRIX_PADDING,
  MATRIX_ROW_HEIGHT,
  MATRIX_SCENE_WIDTH,
  PresenceMatrixLayout,
} from './presenceMatrixLayout';

export function renderPresenceMatrixSvg(
  layout: PresenceMatrixLayout,
  options: {
    title: string;
    subtitle: string;
    background: string;
    surface: string;
    text: string;
    border: string;
  },
): string {
  const body: string[] = [
    `<rect width="${layout.width}" height="${layout.height}" fill="${options.background}"/>`,
    `<text x="${MATRIX_PADDING}" y="22" font-size="16" font-weight="bold" fill="${options.text}">${escapeXml(options.title)}</text>`,
    `<text x="${MATRIX_PADDING}" y="40" font-size="10" fill="${options.text}">${escapeXml(options.subtitle)}</text>`,
  ];
  layout.scenes.forEach((scene, index) => {
    const x = MATRIX_PADDING + MATRIX_LABEL_WIDTH + index * MATRIX_SCENE_WIDTH;
    body.push(
      `<rect x="${x}" y="${MATRIX_PADDING + MATRIX_HEADER_HEIGHT}" width="${MATRIX_SCENE_WIDTH}" height="${layout.rows.length * MATRIX_ROW_HEIGHT}" fill="${index % 2 ? options.surface : options.background}" stroke="${options.border}" stroke-width="0.5"/>`,
    );
    body.push(
      `<rect x="${x}" y="${MATRIX_PADDING + 44}" width="${MATRIX_SCENE_WIDTH}" height="4" fill="${scene.chapterColor}"/>`,
    );
    body.push(
      `<text x="${x + 8}" y="${MATRIX_PADDING + 58}" font-size="10" fill="${options.text}">${escapeXml(truncate(scene.name, 18))}</text>`,
    );
  });
  layout.rows.forEach((row, rowIndex) => {
    const y = MATRIX_PADDING + MATRIX_HEADER_HEIGHT + rowIndex * MATRIX_ROW_HEIGHT;
    body.push(
      `<text x="${MATRIX_PADDING}" y="${y + 33}" font-size="12" font-weight="bold" fill="${row.color}">${escapeXml(truncate(row.label, 20))}</text>`,
    );
    layout.scenes.forEach((scene, sceneIndex) => {
      const value = row.cells.get(scene.id);
      if (!value) return;
      const x = MATRIX_PADDING + MATRIX_LABEL_WIDTH + sceneIndex * MATRIX_SCENE_WIDTH + 10;
      body.push(
        `<rect x="${x}" y="${y + 11}" width="${MATRIX_SCENE_WIDTH - 20}" height="${MATRIX_ROW_HEIGHT - 22}" rx="7" fill="${row.color}" fill-opacity="0.18" stroke="${row.color}"/>`,
      );
      body.push(
        `<text x="${x + 7}" y="${y + 33}" font-size="10" fill="${options.text}">${escapeXml(truncate(value, 15))}</text>`,
      );
    });
  });
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" font-family="Helvetica, Arial, sans-serif"><title>${escapeXml(options.title)}</title><desc>${escapeXml(options.subtitle)}</desc>${body.join('')}</svg>`;
}

function truncate(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
