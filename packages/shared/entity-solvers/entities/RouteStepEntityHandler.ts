import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import type { EntityDomainHandler } from './contracts';

const nameOf = (row: Record<string, unknown> | undefined) => {
  const value = row?.name;
  return typeof value === 'string' && value.trim() ? value : undefined;
};

/** Presentation metadata for one ordered RouteStep. */
export const routeStepEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.RouteStep,
  exportCollection: 'routeSteps',
  exportReferences: [
    { field: 'routeId', targetEntityType: OperationLogEntityType.Route, required: true },
    { field: 'sceneId', targetEntityType: OperationLogEntityType.Scene, required: true },
    {
      field: 'selectedChoiceId',
      targetEntityType: OperationLogEntityType.Choice,
      required: false,
    },
  ],
  help: {
    source: 'routes',
    fields: ['sceneId', 'selectedChoiceId'],
  },
  referenceFields: {
    sceneId: OperationLogEntityType.Scene,
    selectedChoiceId: OperationLogEntityType.Choice,
  },
  async resolveReference(context, entityId) {
    const row = await context.read(OperationLogEntityType.RouteStep, entityId);
    if (!row) return { name: undefined, type: context.translate('route_step') };
    const [route, scene] = await Promise.all([
      context.read(
        OperationLogEntityType.Route,
        typeof row.routeId === 'string' ? row.routeId : '',
      ),
      context.read(
        OperationLogEntityType.Scene,
        typeof row.sceneId === 'string' ? row.sceneId : '',
      ),
    ]);
    return {
      name: `${nameOf(route) ?? context.translate('unknown_entity')} · ${row.position ?? '?'}: ${nameOf(scene) ?? (await context.unknownNoun(OperationLogEntityType.Scene))}`,
      type: context.translate('route_step'),
    };
  },
  async resolveOperationLogName(context, entityId) {
    const row = await context.read(OperationLogEntityType.RouteStep, entityId);
    if (!row) return context.translate('route_step');
    const [route, scene] = await Promise.all([
      context.read(
        OperationLogEntityType.Route,
        typeof row.routeId === 'string' ? row.routeId : '',
      ),
      context.read(
        OperationLogEntityType.Scene,
        typeof row.sceneId === 'string' ? row.sceneId : '',
      ),
    ]);
    const position = typeof row.position === 'number' ? row.position + 1 : '?';
    return `${context.translate('route_step')} - ${nameOf(route) ?? context.translate('unknown_entity')} — ${context.translate('route_step')} ${position}: ${nameOf(scene) ?? (await context.unknownNoun(OperationLogEntityType.Scene))}`;
  },
};
