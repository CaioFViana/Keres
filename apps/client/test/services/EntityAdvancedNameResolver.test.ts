const mockResolve = jest.fn();
const mockContext = jest.fn();
jest.mock('@keres/shared', () => ({
  __esModule: true,
  resolveAdvancedOperationLogEntityName: (...args: unknown[]) => mockResolve(...args),
}));
jest.mock('../../src/services/entity-solvers/ClientEntitySolverContext', () => ({
  __esModule: true,
  createClientEntitySolverContext: (...args: unknown[]) => mockContext(...args),
}));

import { resolveAdvancedEntityName } from '../../src/services/EntityAdvancedNameResolver';

it('delegates composite names to the shared resolver with a client solver context', async () => {
  const db = {} as never;
  const t = jest.fn();
  const context = {};
  mockContext.mockReturnValue(context);
  mockResolve.mockResolvedValue('Mira — strength');
  await expect(
    resolveAdvancedEntityName(db, 'StatStrength' as never, 'tier-1', 'story-1', t as never),
  ).resolves.toBe('Mira — strength');
  expect(mockContext).toHaveBeenCalledWith(db, 'story-1', t);
  expect(mockResolve).toHaveBeenCalledWith(context, 'StatStrength', 'tier-1');
});
