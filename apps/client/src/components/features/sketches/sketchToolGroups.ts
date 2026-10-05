import type { SketchBrushId } from '@keres/shared';
import type { Ionicons } from '@expo/vector-icons';
import type { SketchTool } from '../../../state/sketchToolStore';

type Glyph = keyof typeof Ionicons.glyphMap;

export const BRUSH_ICONS: Record<SketchBrushId, Glyph> = {
  pen: 'pencil-outline',
  marker: 'brush-outline',
  highlighter: 'color-wand-outline',
};

/** One pickable thing in a tool menu: a tool, or a brush kind (which arms the brush tool). */
export interface SketchToolEntry {
  id: string;
  tool: SketchTool;
  /** Set for the brush kinds: picking it also chooses that kind. */
  brush?: SketchBrushId;
  icon: Glyph;
  /** Locale key of the entry's name. */
  labelKey: string;
}

export interface SketchToolGroup {
  id: 'navigate' | 'draw' | 'shapes';
  labelKey: string;
  entries: SketchToolEntry[];
}

const tool = (id: SketchTool, icon: Glyph): SketchToolEntry => ({
  id,
  tool: id,
  icon,
  labelKey: `sketch_tool_${id}`,
});

const brushKind = (brush: SketchBrushId): SketchToolEntry => ({
  id: `brush-${brush}`,
  tool: 'brush',
  brush,
  icon: BRUSH_ICONS[brush],
  labelKey: `sketch_brush_${brush}`,
});

/**
 * On a small screen the twelve tools fold into three menus, so the toolbar fits one row without
 * scrolling: moving around and picking, drawing (the brush kinds, eraser, bucket), and shapes plus
 * objects. Wide screens keep every tool one tap away and ignore this.
 */
export const SKETCH_TOOL_GROUPS: SketchToolGroup[] = [
  {
    id: 'navigate',
    labelKey: 'sketch_group_navigate',
    entries: [
      tool('hand', 'hand-left-outline'),
      tool('select', 'scan-outline'),
      tool('eyedropper', 'eyedrop-outline'),
    ],
  },
  {
    id: 'draw',
    labelKey: 'sketch_group_draw',
    entries: [
      brushKind('pen'),
      brushKind('marker'),
      brushKind('highlighter'),
      tool('eraser', 'backspace-outline'),
      tool('fill', 'color-fill-outline'),
    ],
  },
  {
    id: 'shapes',
    labelKey: 'sketch_group_shapes',
    entries: [
      tool('line', 'remove-outline'),
      tool('rect', 'square-outline'),
      tool('ellipse', 'ellipse-outline'),
      tool('text', 'text-outline'),
      tool('balloon', 'chatbubble-outline'),
      tool('stamp', 'flag-outline'),
    ],
  },
];

/** The entry that is the armed tool right now, if this group holds it. */
export function activeEntry(
  group: SketchToolGroup,
  active: SketchTool,
  brush: SketchBrushId,
): SketchToolEntry | undefined {
  return group.entries.find((entry) =>
    entry.brush ? active === 'brush' && entry.brush === brush : entry.tool === active,
  );
}
