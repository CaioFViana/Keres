import type {
  PresenceMatrixLayout} from './presenceMatrixLayout';
import {
  buildMatrixThreadSegments,
  MATRIX_CELL_INSET,
  MATRIX_HEADER_HEIGHT,
  MATRIX_LABEL_WIDTH,
  MATRIX_PADDING,
  MATRIX_ROW_HEIGHT,
  MATRIX_THREAD_GAP_DASH,
  MATRIX_THREAD_OPACITY,
  MATRIX_THREAD_WIDTH,
  matrixRowCenterY
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
    showRowCoverage: boolean;
  },
): string {
  const body: string[] = [
    `<rect width="${layout.width}" height="${layout.height}" fill="${options.background}"/>`,
    `<text x="${MATRIX_PADDING}" y="22" font-size="16" font-weight="bold" fill="${options.text}">${escapeXml(options.title)}</text>`,
    `<text x="${MATRIX_PADDING}" y="40" font-size="10" fill="${options.text}">${escapeXml(options.subtitle)}</text>`,
  ];
  const chapterGroups: { name: string; color: string; start: number; end: number }[] = [];
  layout.scenes.forEach((scene, index) => {
    const last = chapterGroups.at(-1);
    if (last && last.name === scene.chapterName) last.end = index;
    else
      chapterGroups.push({
        name: scene.chapterName,
        color: scene.chapterColor,
        start: index,
        end: index,
      });
  });
  chapterGroups.forEach((chapter) => {
    const x = MATRIX_PADDING + MATRIX_LABEL_WIDTH + chapter.start * layout.sceneWidth;
    const width = (chapter.end - chapter.start + 1) * layout.sceneWidth;
    body.push(
      `<text x="${x + 5}" y="${MATRIX_PADDING + 9}" font-size="10" font-weight="bold" fill="${options.text}" fill-opacity="0.72">${escapeXml(truncate(chapter.name, Math.max(12, Math.floor(width / 7))))}</text>`,
    );
  });
  layout.scenes.forEach((scene, index) => {
    const x = MATRIX_PADDING + MATRIX_LABEL_WIDTH + index * layout.sceneWidth;
    body.push(
      `<rect x="${x}" y="${MATRIX_PADDING + MATRIX_HEADER_HEIGHT}" width="${layout.sceneWidth}" height="${layout.rows.length * MATRIX_ROW_HEIGHT}" fill="${index % 2 ? options.surface : options.background}" stroke="${options.border}" stroke-width="0.5"/>`,
    );
    body.push(
      `<rect x="${x}" y="${MATRIX_PADDING + MATRIX_HEADER_HEIGHT - 6}" width="${layout.sceneWidth}" height="4" fill="${scene.chapterColor}"/>`,
    );
    body.push(
      `<text x="${x + 8}" y="${MATRIX_PADDING + 44}" font-size="10" fill="${options.text}">${escapeXml(truncate(`${index + 1}. ${scene.name}`, Math.max(10, Math.floor(layout.sceneWidth / 6))))}</text>`,
    );
  });
  // O fio vem antes das células, como na tela: ele passa por baixo, não por cima.
  layout.rows.forEach((row, rowIndex) => {
    const threadY = matrixRowCenterY(rowIndex);
    buildMatrixThreadSegments(row, layout.scenes, layout.sceneWidth).forEach((segment) => {
      const dash = segment.isGap ? ` stroke-dasharray="${MATRIX_THREAD_GAP_DASH}"` : '';
      body.push(
        `<line x1="${segment.x1}" y1="${threadY}" x2="${segment.x2}" y2="${threadY}" stroke="${row.color}" stroke-width="${MATRIX_THREAD_WIDTH}" stroke-opacity="${MATRIX_THREAD_OPACITY}" stroke-linecap="round"${dash}/>`,
      );
    });
  });
  layout.rows.forEach((row, rowIndex) => {
    const y = MATRIX_PADDING + MATRIX_HEADER_HEIGHT + rowIndex * MATRIX_ROW_HEIGHT;
    const percentage = Math.round((row.cells.size / layout.scenes.length || 0) * 100);
    body.push(
      `<text x="${MATRIX_PADDING}" y="${y + (options.showRowCoverage ? 26 : 33)}" font-size="12" font-weight="bold" fill="${row.color}">${escapeXml(truncate(row.label, 20))}</text>`,
    );
    if (options.showRowCoverage)
      body.push(
        `<text x="${MATRIX_PADDING}" y="${y + 42}" font-size="10" fill="${options.text}" fill-opacity="0.72">${row.cells.size}/${layout.scenes.length} (${percentage}%)</text>`,
      );
    layout.scenes.forEach((scene, sceneIndex) => {
      const value = row.cells.get(scene.id);
      if (!value) return;
      const x =
        MATRIX_PADDING + MATRIX_LABEL_WIDTH + sceneIndex * layout.sceneWidth + MATRIX_CELL_INSET;
      body.push(
        `<rect x="${x}" y="${y + 11}" width="${layout.sceneWidth - MATRIX_CELL_INSET * 2}" height="${MATRIX_ROW_HEIGHT - 22}" rx="7" fill="${row.color}" fill-opacity="0.18" stroke="${row.color}"/>`,
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
