import type { MapExportFormat } from '@keres/shared/entities/ClientSettings';
import { useExportFormatPromptStore } from '../state/exportFormatPromptStore';

/**
 * Asks which file to export - SVG or PNG - every time, and resolves `null` when the user closes the
 * chooser. Every canvas export goes through this, so the choice lives where the user makes it
 * instead of in a global setting.
 */
export function chooseExportFormat(): Promise<MapExportFormat | null> {
  return useExportFormatPromptStore.getState().ask();
}
