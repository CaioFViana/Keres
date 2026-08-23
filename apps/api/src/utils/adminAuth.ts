import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { JWTPayload } from '../index';
import { AppError } from './errors';

/**
 * Guarda centralizada para as rotas /api/admin/*, no lugar de cada módulo repetir a
 * checagem (como `requirePermission` em media.route.ts fazia por módulo).
 *
 * `isAdmin` é checado no banco a cada request, nunca confiado a partir do JWT: o token
 * vive 1h e esta API não tem lista de revogação, então uma claim `isAdmin` embutida no
 * token continuaria válida por até uma hora depois de um admin ser rebaixado ou excluído.
 *
 * Função simples em vez de um plugin Elysia com `.derive()`: compor esse derive através de
 * `.use()` entre módulos não propagava o tipo `requireAdmin` de forma confiável para as
 * rotas - uma função chamada explicitamente com `user` do contexto é mais simples e evita
 * essa armadilha do sistema de tipos.
 */
export async function requireAdmin(user: JWTPayload | null): Promise<string> {
  if (!user?.userId) {
    throw new AppError(401, 'Unauthorized');
  }
  const row = await db.query.users.findFirst({
    where: eq(users.id, user.userId),
    columns: { id: true, isAdmin: true, isDeleted: true },
  });
  if (!row || row.isDeleted || !row.isAdmin) {
    throw new AppError(403, 'Admin access required.');
  }
  return row.id;
}
