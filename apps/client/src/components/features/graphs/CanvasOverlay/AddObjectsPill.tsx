import type { Ionicons } from '@expo/vector-icons';
import { CANVAS_OVERLAY_PRESETS } from '@keres/shared/graphs/canvasOverlayGeometry';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StyleProp, ViewStyle } from 'react-native';
import MultiSelectPill, {
  type MultiSelectGroup,
} from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import type { AddObjectsAction, OverlayDrawTool } from './overlayTools';

type Glyph = keyof typeof Ionicons.glyphMap;

const DRAW_TOOLS: { tool: OverlayDrawTool; icon: Glyph }[] = [
  { tool: 'line', icon: 'remove-outline' },
  { tool: 'polygon', icon: 'shapes-outline' },
  { tool: 'frame', icon: 'square-outline' },
  { tool: 'rect', icon: 'square' },
  { tool: 'ellipse', icon: 'ellipse-outline' },
];

const PRESET_ICONS: Record<string, Glyph | undefined> = {
  triangle: 'triangle-outline',
  square: 'square-outline',
  diamond: 'diamond-outline',
  pentagon: undefined,
  hexagon: undefined,
  star: 'star-outline',
};

interface AddObjectsPillProps {
  /** Boards add free notes through the pill; maps keep their richer marker button. */
  includeNote: boolean;
  onAction: (action: AddObjectsAction) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * The "add objects" picker above a canvas: notes, drawing tools, pre-made shape presets
 * and the select tool, grouped like the entity pickers. An action, not a filter: every
 * choice fires once and the pill clears, so the same action stays immediately available.
 */
const AddObjectsPill: React.FC<AddObjectsPillProps> = ({ includeNote, onAction, style }) => {
  const { t } = useTranslation();
  const [values, setValues] = useState<string[]>([]);

  const groups: MultiSelectGroup[] = [];
  if (includeNote) {
    groups.push({
      key: 'note',
      label: t('objects_group_note'),
      icon: 'document-text-outline',
      options: [{ label: t('objects_note'), value: 'note', icon: 'document-text-outline' }],
    });
  }
  groups.push({
    key: 'draw',
    label: t('objects_group_draw'),
    icon: 'pencil',
    options: DRAW_TOOLS.map(({ tool, icon }) => ({
      label: t(`objects_draw_${tool}`),
      value: `draw:${tool}`,
      icon,
    })),
  });
  groups.push({
    key: 'presets',
    label: t('objects_group_presets'),
    icon: 'shapes-outline',
    options: CANVAS_OVERLAY_PRESETS.map((preset) => ({
      label: t(`objects_preset_${preset}`),
      value: `preset:${preset}`,
      ...(PRESET_ICONS[preset] ? { icon: PRESET_ICONS[preset] as Glyph } : {}),
    })),
  });
  groups.push({
    key: 'select',
    label: t('objects_group_select'),
    icon: 'locate-outline',
    options: [{ label: t('objects_select'), value: 'select', icon: 'locate-outline' }],
  });

  return (
    <MultiSelectPill
      style={style}
      groups={groups}
      selectedValues={values}
      onSelectionChange={(selected) => {
        const action = selected[0] as AddObjectsAction | undefined;
        if (!action) {
          setValues([]);
          return;
        }
        onAction(action);
        setValues([action]);
        requestAnimationFrame(() => setValues([]));
      }}
      placeholder={t('objects_add')}
      noOptionsText={t('objects_add')}
      singleSelect
    />
  );
};

export default AddObjectsPill;
