import { SKETCH_BRUSH_IDS, SKETCH_BRUSHES, type SketchBrushId } from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { CanvasActionBarButton } from '@/src/components/features/graphs/CanvasActionBar/CanvasActionBar';
import { useSketchCompact } from '../../../hooks/useSketchCompact';
import { isStrokeTool, useSketchToolStore, type SketchTool } from '../../../state/sketchToolStore';
import { useTheme } from '../../../theme';
import SketchSlider from './SketchSlider';

const BRUSH_ICONS: Record<SketchBrushId, keyof typeof Ionicons.glyphMap> = {
  pen: 'pencil-outline',
  marker: 'brush-outline',
  highlighter: 'color-wand-outline',
};

export interface SketchSelectionActions {
  count: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onDone: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onFlip: (axis: 'horizontal' | 'vertical') => void;
  onReorder: (direction: 'front' | 'back') => void;
  onMoveToLayer: (direction: 'up' | 'down') => void;
}

/**
 * The strip never changes height. Its tallest content is a slider (label row plus 32 px track, about
 * 47 px, plus the row padding), so every tool's options sit centered in the same box: swapping tools
 * must not resize the canvas below, because a resized canvas refits its camera and throws away the
 * user's zoom.
 */
export const SKETCH_OPTIONS_BAR_HEIGHT = 64;

const OBJECT_HINTS: Record<string, string> = {
  text: 'overlay_draw_text_hint',
  stamp: 'overlay_draw_stamp_hint',
  balloon: 'overlay_draw_balloon_hint',
};

interface SketchOptionsBarProps {
  tool: SketchTool;
  /** While an object tool (text, balloon, stamp) is armed, the strip shows its hint and a cancel. */
  objectTool?: boolean;
  onCancelObject?: () => void;
  /** Hex of the current color, shown on the swatch. */
  onOpenColor: () => void;
  selection: SketchSelectionActions | null;
}

const hint = (tool: SketchTool): string | null => {
  switch (tool) {
    case 'hand':
      return 'sketch_hint_hand';
    case 'eyedropper':
      return 'sketch_hint_eyedropper';
    case 'select':
      return 'sketch_hint_select';
    default:
      return null;
  }
};

/**
 * The strip under the tools: whatever the armed tool needs within reach - brush kind, color,
 * size, opacity, fill tolerance, selection actions - so nothing about the pen hides in a sheet.
 */
const SketchOptionsBar: React.FC<SketchOptionsBarProps> = ({
  tool,
  objectTool = false,
  onCancelObject,
  onOpenColor,
  selection,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const store = useSketchToolStore();
  // On a small screen the brush kinds live in the drawing menu, the toggles shrink to icons and
  // the sliders share the row instead of keeping a fixed width.
  const compact = useSketchCompact();
  const { width: windowWidth } = useWindowDimensions();
  const styles = StyleSheet.create({
    bar: {
      height: SKETCH_OPTIONS_BAR_HEIGHT,
      justifyContent: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: compact ? 10 : 14,
      paddingHorizontal: compact ? 10 : 12,
      paddingVertical: 6,
      flexGrow: 1,
    },
    chips: { flexDirection: 'row', gap: 6 },
    chip: {
      width: 40,
      height: 36,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    textChip: {
      paddingHorizontal: 10,
      height: 36,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textChipLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
    textChipLabelActive: { color: colors.onPrimary },
    swatch: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 2,
      borderColor: colors.border,
    },
    iconChip: {
      width: 36,
      height: 36,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hint: {
      color: colors.textSecondary,
      fontSize: compact ? 12 : 13,
      paddingVertical: 8,
      // Room for the control beside it; two lines instead of a scroll on a phone.
      maxWidth: compact ? windowWidth - 110 : undefined,
    },
    scroll: { flexGrow: 0 },
    slider: compact ? { flex: 1, minWidth: 96 } : { width: 150 },
    selectionRow: { flexDirection: 'row', alignItems: 'center' },
  });

  const strokeLike = isStrokeTool(tool);
  const brushSize = store.sizeByBrush[store.brush];
  const brushAlpha = store.alphaByBrush[store.brush];
  const spec = SKETCH_BRUSHES[store.brush];

  const colorSwatch = (
    <TouchableOpacity
      testID="sketch-color-swatch"
      accessibilityRole="button"
      accessibilityLabel={t('sketch_color_title')}
      onPress={onOpenColor}
      style={[styles.swatch, { backgroundColor: store.color }]}
    />
  );

  let content: React.ReactNode = null;
  if (objectTool) {
    const key = OBJECT_HINTS[tool];
    content = (
      <>
        {key && (
          <Text style={styles.hint} numberOfLines={2}>
            {t(key)}
          </Text>
        )}
        <CanvasActionBarButton
          testID="sketch-object-cancel"
          icon="close-outline"
          label={t('overlay_draw_cancel')}
          onPress={() => onCancelObject?.()}
        />
      </>
    );
  } else if (strokeLike) {
    content = (
      <>
        {!compact && (
          <View style={styles.chips}>
            {SKETCH_BRUSH_IDS.map((id) => {
              const active = store.brush === id;
              return (
                <TouchableOpacity
                  key={id}
                  testID={`sketch-brush-${id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={t(`sketch_brush_${id}`)}
                  onPress={() => store.setBrush(id)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Ionicons
                    name={BRUSH_ICONS[id]}
                    size={20}
                    color={active ? colors.onPrimary : colors.text}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        {colorSwatch}
        <View style={styles.slider}>
          <SketchSlider
            testID="sketch-size-slider"
            label={t('sketch_size')}
            value={brushSize}
            min={spec.minSize}
            max={spec.maxSize}
            curve="quadratic"
            valueText={String(Math.round(brushSize * 10) / 10)}
            onChange={store.setSize}
          />
        </View>
        <View style={styles.slider}>
          <SketchSlider
            testID="sketch-opacity-slider"
            label={t('sketch_opacity')}
            value={brushAlpha}
            min={0.05}
            max={1}
            valueText={`${Math.round(brushAlpha * 100)}%`}
            onChange={store.setAlpha}
          />
        </View>
      </>
    );
  } else if (tool === 'eraser') {
    content = (
      <>
        <View style={styles.slider}>
          <SketchSlider
            testID="sketch-eraser-size-slider"
            label={t('sketch_size')}
            value={store.eraserSize}
            min={4}
            max={160}
            curve="quadratic"
            valueText={String(Math.round(store.eraserSize))}
            onChange={store.setEraserSize}
          />
        </View>
        {!compact && (
          <Text style={styles.hint} numberOfLines={2}>
            {t('sketch_hint_eraser')}
          </Text>
        )}
      </>
    );
  } else if (tool === 'fill') {
    content = (
      <>
        {colorSwatch}
        <View style={styles.slider}>
          <SketchSlider
            testID="sketch-gap-slider"
            label={t('sketch_fill_gap')}
            value={store.fillGap}
            min={0}
            max={20}
            valueText={String(Math.round(store.fillGap))}
            onChange={store.setFillGap}
          />
        </View>
        <View style={styles.slider}>
          <SketchSlider
            testID="sketch-tolerance-slider"
            label={t('sketch_fill_tolerance')}
            value={store.fillTolerance}
            min={0}
            max={160}
            valueText={String(Math.round(store.fillTolerance))}
            onChange={store.setFillTolerance}
          />
        </View>
        <TouchableOpacity
          testID="sketch-fill-sample"
          accessibilityRole="switch"
          accessibilityLabel={t(
            store.fillSampleAll ? 'sketch_fill_all_layers' : 'sketch_fill_this_layer',
          )}
          accessibilityState={{ checked: store.fillSampleAll }}
          onPress={() => store.setFillSampleAll(!store.fillSampleAll)}
          style={[
            compact ? styles.iconChip : styles.textChip,
            store.fillSampleAll && styles.chipActive,
          ]}
        >
          {compact ? (
            <Ionicons
              name={store.fillSampleAll ? 'layers' : 'layers-outline'}
              size={20}
              color={store.fillSampleAll ? colors.onPrimary : colors.text}
            />
          ) : (
            <Text style={[styles.textChipLabel, store.fillSampleAll && styles.textChipLabelActive]}>
              {t(store.fillSampleAll ? 'sketch_fill_all_layers' : 'sketch_fill_this_layer')}
            </Text>
          )}
        </TouchableOpacity>
      </>
    );
  } else if (tool === 'select') {
    const lasso = (
      <TouchableOpacity
        testID="sketch-lasso-mode"
        accessibilityRole="button"
        accessibilityLabel={t(
          store.lassoMode === 'whole' ? 'sketch_lasso_whole' : 'sketch_lasso_cut',
        )}
        onPress={() => store.setLassoMode(store.lassoMode === 'whole' ? 'cut' : 'whole')}
        style={[
          compact ? styles.iconChip : styles.textChip,
          compact && store.lassoMode === 'cut' && styles.chipActive,
        ]}
      >
        {compact ? (
          <Ionicons
            name="cut-outline"
            size={20}
            color={store.lassoMode === 'cut' ? colors.onPrimary : colors.text}
          />
        ) : (
          <Text style={styles.textChipLabel}>
            {t(store.lassoMode === 'whole' ? 'sketch_lasso_whole' : 'sketch_lasso_cut')}
          </Text>
        )}
      </TouchableOpacity>
    );
    content = selection ? (
      <View style={styles.selectionRow}>
        <CanvasActionBarButton
          icon="close-outline"
          label={t('overlay_deselect')}
          onPress={selection.onDone}
        />
        <CanvasActionBarButton
          icon="trash-outline"
          label={t('sketch_selection_delete')}
          onPress={selection.onDelete}
        />
        <CanvasActionBarButton
          icon="copy-outline"
          label={t('sketch_selection_duplicate')}
          onPress={selection.onDuplicate}
        />
        <CanvasActionBarButton
          icon="swap-horizontal-outline"
          label={t('sketch_selection_flip_h')}
          onPress={() => selection.onFlip('horizontal')}
        />
        <CanvasActionBarButton
          icon="swap-vertical-outline"
          label={t('sketch_selection_flip_v')}
          onPress={() => selection.onFlip('vertical')}
        />
        <CanvasActionBarButton
          icon="layers"
          label={t('overlay_bring_to_front')}
          onPress={() => selection.onReorder('front')}
        />
        <CanvasActionBarButton
          icon="layers-outline"
          label={t('overlay_send_to_back')}
          onPress={() => selection.onReorder('back')}
        />
        <CanvasActionBarButton
          icon="arrow-up-outline"
          label={t('sketch_selection_layer_up')}
          disabled={!selection.canMoveUp}
          onPress={() => selection.onMoveToLayer('up')}
        />
        <CanvasActionBarButton
          icon="arrow-down-outline"
          label={t('sketch_selection_layer_down')}
          disabled={!selection.canMoveDown}
          onPress={() => selection.onMoveToLayer('down')}
        />
        {lasso}
      </View>
    ) : (
      <>
        {lasso}
        <Text style={styles.hint} numberOfLines={2}>
          {t('sketch_hint_select')}
        </Text>
      </>
    );
  } else {
    const key = hint(tool);
    content = key ? (
      <Text style={styles.hint} numberOfLines={2}>
        {t(key)}
      </Text>
    ) : null;
  }

  return (
    <View style={styles.bar} testID="sketch-options-bar">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        contentContainerStyle={{ minWidth: '100%' }}
      >
        <View style={styles.row}>{content}</View>
      </ScrollView>
    </View>
  );
};

export default SketchOptionsBar;
