import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import type { EntityDomainHandler } from './contracts';

const nameOf = (row: Record<string, unknown> | undefined) => {
  const value = row?.name;
  return typeof value === 'string' && value.trim() ? value : undefined;
};

/** Presentation metadata for attaching a Scene to a Plot. */
export const plotSceneEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.PlotScene,
  exportCollection: 'plotScenes',
  exportReferences: [
    { field: 'plotId', targetEntityType: OperationLogEntityType.Plot, required: true },
    { field: 'sceneId', targetEntityType: OperationLogEntityType.Scene, required: true },
  ],
  help: {
    source: 'plots',
    fields: ['note'],
  },
  referenceFields: {
    plotId: OperationLogEntityType.Plot,
    sceneId: OperationLogEntityType.Scene,
  },
  async resolveReference(context, entityId) {
    const row = await context.read(OperationLogEntityType.PlotScene, entityId);
    if (!row) return { name: undefined, type: context.translate('plot_scenes') };
    const [plot, scene] = await Promise.all([
      context.read(OperationLogEntityType.Plot, typeof row.plotId === 'string' ? row.plotId : ''),
      context.read(
        OperationLogEntityType.Scene,
        typeof row.sceneId === 'string' ? row.sceneId : '',
      ),
    ]);
    return {
      name: `${nameOf(plot) ?? context.translate('plots_title')} — ${nameOf(scene) ?? (await context.noun(OperationLogEntityType.Scene, true))}`,
      type: context.translate('plot_scenes'),
    };
  },
  async resolveOperationLogName(context, entityId) {
    const reference = await plotSceneEntityHandler.resolveReference!(context, entityId);
    return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
  },
};
