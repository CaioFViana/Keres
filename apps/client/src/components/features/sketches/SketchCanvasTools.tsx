import type { SketchBrushId } from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  CanvasActionBar,
  CanvasActionBarButton,
} from '@/src/components/features/graphs/CanvasActionBar/CanvasActionBar';
import { useSketchCompact } from '../../../hooks/useSketchCompact';
import type { SketchTool } from '../../../state/sketchToolStore';
import { type ThemeColors, useTheme } from '../../../theme';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import SketchMenuSheet, { type SketchMenuItem } from './SketchMenuSheet';
import {
  activeEntry,
  BRUSH_ICONS,
  SKETCH_TOOL_GROUPS,
  type SketchToolEntry,
  type SketchToolGroup,
} from './sketchToolGroups';
import GuideAnchor from '@/src/guides/GuideAnchor';

interface SketchCanvasToolsProps {
  tool: SketchTool;
  /** The brush kind in use, so the drawing menu can show which one is armed. */
  brush: SketchBrushId;
  canEdit: boolean;
  canUndo: boolean;
  canRedo: boolean;
  rotationActive: boolean;
  onTool: (tool: SketchTool) => void;
  onBrush: (brush: SketchBrushId) => void;
  onUndo: () => void;
  onRedo: () => void;
  onResetRotation: () => void;
  onOpenLayers: () => void;
  onOpenPage: () => void;
}

const TOOL_BUTTONS: { tool: SketchTool; icon: keyof typeof Ionicons.glyphMap }[] = [
  { tool: 'hand', icon: 'hand-left-outline' },
  { tool: 'select', icon: 'scan-outline' },
  { tool: 'brush', icon: 'brush-outline' },
  { tool: 'eraser', icon: 'backspace-outline' },
  { tool: 'fill', icon: 'color-fill-outline' },
  { tool: 'eyedropper', icon: 'eyedrop-outline' },
  { tool: 'line', icon: 'remove-outline' },
  { tool: 'rect', icon: 'square-outline' },
  { tool: 'ellipse', icon: 'ellipse-outline' },
  { tool: 'text', icon: 'text-outline' },
  { tool: 'balloon', icon: 'chatbubble-outline' },
  { tool: 'stamp', icon: 'flag-outline' },
];

type OpenMenu = { kind: 'group'; group: SketchToolGroup } | { kind: 'more' } | null;

/**
 * The tools of the sketch: modes, not one-shot actions. A tool stays armed until another is
 * picked (drawing ten strokes is ten gestures, not ten taps), `hand` returns the single finger to
 * the camera, and the document actions (undo/redo, layers, page) sit after the tools.
 *
 * Wide screens show every tool. On a small screen the tools fold into three group buttons - each
 * wearing the icon of the tool it will arm - and the rarely used document actions move behind an
 * overflow menu, so the whole bar fits one row. Tapping a group that is not armed arms its last
 * tool; tapping the armed group (or long-pressing any) opens the menu to pick another.
 */
const SketchCanvasTools: React.FC<SketchCanvasToolsProps> = (props) => {
  const {
    tool,
    brush,
    canEdit,
    canUndo,
    canRedo,
    rotationActive,
    onTool,
    onBrush,
    onUndo,
    onRedo,
    onResetRotation,
    onOpenLayers,
    onOpenPage,
  } = props;
  const { t } = useTranslation();
  const { colors } = useTheme();
  const compact = useSketchCompact();
  const [menu, setMenu] = useState<OpenMenu>(null);
  const [lastByGroup, setLastByGroup] = useState<Record<string, string>>({});
  const styles = useThemedStyles(createStyles);

  const pick = (entry: SketchToolEntry, group: SketchToolGroup) => {
    setLastByGroup((current) => ({ ...current, [group.id]: entry.id }));
    if (entry.brush) onBrush(entry.brush);
    else onTool(entry.tool);
  };

  const groupEntry = (group: SketchToolGroup): SketchToolEntry =>
    activeEntry(group, tool, brush) ??
    group.entries.find((entry) => entry.id === lastByGroup[group.id]) ??
    group.entries[0];

  const undoRedo = canEdit && (
    <>
      <CanvasActionBarButton
        dense={compact}
        testID="sketch-undo"
        icon="arrow-undo-outline"
        label={t('sketch_undo')}
        disabled={!canUndo}
        onPress={onUndo}
      />
      <CanvasActionBarButton
        dense={compact}
        testID="sketch-redo"
        icon="arrow-redo-outline"
        label={t('sketch_redo')}
        disabled={!canRedo}
        onPress={onRedo}
      />
    </>
  );
  const readOnlyLock = !canEdit && (
    <TouchableOpacity accessibilityLabel={t('sketch_readonly')} disabled>
      <Ionicons name="lock-closed-outline" size={22} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  const bar = compact ? (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <CanvasActionBar>
        {canEdit &&
          SKETCH_TOOL_GROUPS.map((group) => {
            const current = groupEntry(group);
            const armed = !!activeEntry(group, tool, brush);
            return (
              <TouchableOpacity
                key={group.id}
                testID={`sketch-group-${group.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected: armed }}
                accessibilityLabel={t(group.labelKey)}
                onPress={() => (armed ? setMenu({ kind: 'group', group }) : pick(current, group))}
                onLongPress={() => setMenu({ kind: 'group', group })}
                style={styles.groupButton}
              >
                <Ionicons
                  name={current.icon}
                  size={22}
                  color={armed ? colors.primary : colors.text}
                />
                <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
              </TouchableOpacity>
            );
          })}
        {canEdit && <View style={styles.divider} />}
        {undoRedo}
        <CanvasActionBarButton
          dense
          testID="sketch-layers"
          icon="layers-outline"
          label={t('sketch_layers')}
          onPress={onOpenLayers}
        />
        {canEdit && (
          <CanvasActionBarButton
            dense
            testID="sketch-more"
            icon="ellipsis-horizontal"
            label={t('sketch_more')}
            onPress={() => setMenu({ kind: 'more' })}
          />
        )}
        {readOnlyLock}
      </CanvasActionBar>
    </ScrollView>
  ) : (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <CanvasActionBar>
        {canEdit &&
          TOOL_BUTTONS.map(({ tool: id, icon }) => (
            <CanvasActionBarButton
              key={id}
              testID={`sketch-tool-${id}`}
              icon={id === 'brush' ? BRUSH_ICONS[brush] : icon}
              label={t(`sketch_tool_${id}`)}
              active={tool === id}
              onPress={() => onTool(id)}
            />
          ))}
        {canEdit && <View style={styles.divider} />}
        {undoRedo}
        {rotationActive && (
          <CanvasActionBarButton
            icon="refresh-outline"
            label={t('sketch_reset_rotation')}
            onPress={onResetRotation}
          />
        )}
        <CanvasActionBarButton
          testID="sketch-layers"
          icon="layers-outline"
          label={t('sketch_layers')}
          onPress={onOpenLayers}
        />
        {canEdit && (
          <CanvasActionBarButton
            testID="sketch-page"
            icon="newspaper-outline"
            label={t('sketch_page')}
            onPress={onOpenPage}
          />
        )}
        {readOnlyLock}
      </CanvasActionBar>
    </ScrollView>
  );

  let sheet: React.ReactNode = null;
  if (menu?.kind === 'group') {
    const { group } = menu;
    const items: SketchMenuItem[] = group.entries.map((entry) => ({
      id: entry.id,
      icon: entry.icon,
      label: t(entry.labelKey),
      selected: activeEntry(group, tool, brush)?.id === entry.id,
      onPress: () => pick(entry, group),
    }));
    sheet = (
      <SketchMenuSheet title={t(group.labelKey)} items={items} onClose={() => setMenu(null)} />
    );
  } else if (menu?.kind === 'more') {
    const items: SketchMenuItem[] = [
      { id: 'page', icon: 'newspaper-outline', label: t('sketch_page'), onPress: onOpenPage },
      ...(rotationActive
        ? [
            {
              id: 'rotation',
              icon: 'refresh-outline' as const,
              label: t('sketch_reset_rotation'),
              onPress: onResetRotation,
            },
          ]
        : []),
    ];
    sheet = (
      <SketchMenuSheet title={t('sketch_more')} items={items} onClose={() => setMenu(null)} />
    );
  }

  return (
    <GuideAnchor screen="SketchCanvas" part="tools">
      {bar}
      {sheet}
    </GuideAnchor>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    divider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      backgroundColor: colors.border,
      marginHorizontal: 4,
    },
    groupButton: {
      paddingHorizontal: 8,
      paddingVertical: 8,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
  });

export default SketchCanvasTools;
