import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
import {
  CanvasActionBar,
  CanvasActionBarButton,
} from '@/src/components/features/graphs/CanvasActionBar/CanvasActionBar';
import { useScreenAnchor } from '../../../guides/useGuideAnchor';
import { useTheme } from '../../../theme';
import type { OverlayDrawTool } from '../graphs/CanvasOverlay/overlayTools';

interface SketchCanvasToolsProps {
  drawTool: OverlayDrawTool | null;
  selectMode: boolean;
  canEdit: boolean;
  canUndo: boolean;
  canRedo: boolean;
  rotationActive: boolean;
  onSelectMode: () => void;
  onDrawTool: (tool: OverlayDrawTool) => void;
  onOpenPresets: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onResetRotation: () => void;
  onOpenLayers: () => void;
  onOpenPage: () => void;
}

const DRAW_BUTTONS: { tool: OverlayDrawTool; icon: keyof typeof Ionicons.glyphMap }[] = [
  { tool: 'freehand', icon: 'pencil-outline' },
  { tool: 'line', icon: 'remove-outline' },
  { tool: 'polygon', icon: 'shapes-outline' },
  { tool: 'rect', icon: 'square-outline' },
  { tool: 'text', icon: 'text-outline' },
  { tool: 'stamp', icon: 'flag-outline' },
];

/**
 * One row of momentary tools: tap a tool, draw, and it disarms itself. There are no
 * exclusive modes here (unlike boards): idle selects and moves, tools fire once. The
 * shape presets live behind one picker, and document actions (undo/redo, layers, page)
 * sit right of the divider.
 */
const SketchCanvasTools: React.FC<SketchCanvasToolsProps> = ({
  drawTool,
  selectMode,
  canEdit,
  canUndo,
  canRedo,
  rotationActive,
  onSelectMode,
  onDrawTool,
  onOpenPresets,
  onUndo,
  onRedo,
  onResetRotation,
  onOpenLayers,
  onOpenPage,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const toolsAnchorRef = useScreenAnchor('SketchCanvas', 'tools');
  return (
    <View ref={toolsAnchorRef} collapsable={false}>
      <CanvasActionBar>
        <CanvasActionBarButton
          icon="move-outline"
          label={t('sketch_tool_select')}
          active={selectMode}
          onPress={onSelectMode}
        />
        {DRAW_BUTTONS.map(({ tool, icon }) => (
          <CanvasActionBarButton
            key={tool}
            icon={icon}
            label={t(`sketch_tool_${tool}`)}
            active={drawTool === tool}
            onPress={() => onDrawTool(tool)}
          />
        ))}
        <CanvasActionBarButton
          icon="shapes-outline"
          label={t('sketch_tool_shapes')}
          onPress={onOpenPresets}
        />
        <CanvasActionBarButton
          icon="arrow-undo-outline"
          label={t('sketch_undo')}
          disabled={!canUndo}
          onPress={onUndo}
        />
        <CanvasActionBarButton
          icon="arrow-redo-outline"
          label={t('sketch_redo')}
          disabled={!canRedo}
          onPress={onRedo}
        />
        {rotationActive && (
          <CanvasActionBarButton
            icon="refresh-outline"
            label={t('sketch_reset_rotation')}
            onPress={onResetRotation}
          />
        )}
        <CanvasActionBarButton
          icon="layers-outline"
          label={t('sketch_layers')}
          onPress={onOpenLayers}
        />
        <CanvasActionBarButton icon="newspaper-outline" label={t('sketch_page')} onPress={onOpenPage} />
        {!canEdit && (
          <TouchableOpacity accessibilityLabel={t('sketch_readonly')} disabled>
            <Ionicons name="lock-closed-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </CanvasActionBar>
    </View>
  );
};

export default SketchCanvasTools;
