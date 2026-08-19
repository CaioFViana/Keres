import { z } from 'zod';

export const PublicationLabelModeSchema = z.enum(['version', 'date', 'both']);
export const ShowcaseVisibilitySchema = z.enum(['public', 'password']);

export const StoryPublicationSnapshotSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  genre: z.string().nullable(),
  language: z.string().nullable(),
  author: z.string().nullable(),
  type: z.enum(['linear', 'branching']),
  theme: z.string().nullable(),
});

export const StoryPublicationSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  ownerUserId: z.string(),
  label: z.string(),
  operationVersion: z.number().int(),
  formatVersion: z.number().int(),
  byteSize: z.number().int(),
  mediaIncluded: z.number().int(),
  mediaTotal: z.number().int(),
  createdAt: z.coerce.date(),
});

/**
 * O que o dono manda ao publicar. `operationVersion` é o `lastOperationLog` local: o servidor
 * compara com o dele e recusa (409) se não baterem, porque publicar uma história que ainda tem
 * mudança local pendente geraria um pacote que não corresponde a nada que exista dos dois lados.
 */
export const CreatePublicationRequestSchema = z.object({
  operationVersion: z.number().int().nonnegative(),
  labelMode: PublicationLabelModeSchema.default('both'),
});

export const UpdateShowcaseVisibilityRequestSchema = z
  .object({
    visibility: ShowcaseVisibilitySchema,
    /** Obrigatória ao mudar para `password`; ignorada em `public`. */
    password: z.string().min(4).max(200).optional(),
  })
  .refine((data) => data.visibility === 'public' || !!data.password, {
    message: 'A password is required for password-protected stories.',
    path: ['password'],
  });

export const ShowcaseOwnerSchema = z.object({
  username: z.string(),
  tag: z.string(),
  avatarColor: z.string().nullable(),
  avatarIcon: z.string().nullable(),
});

export const ShowcaseVersionSchema = z.object({
  id: z.string(),
  label: z.string(),
  byteSize: z.number().int(),
  mediaIncluded: z.number().int(),
  mediaTotal: z.number().int(),
  createdAt: z.string(),
});

export const ShowcaseStoryCardSchema = z.object({
  storyId: z.string(),
  snapshot: StoryPublicationSnapshotSchema,
  owner: ShowcaseOwnerSchema,
  versionCount: z.number().int(),
  latestVersion: ShowcaseVersionSchema,
  updatedAt: z.string(),
});

export const ShowcaseStoryDetailSchema = z.object({
  storyId: z.string(),
  snapshot: StoryPublicationSnapshotSchema,
  owner: ShowcaseOwnerSchema,
  versions: z.array(ShowcaseVersionSchema),
  updatedAt: z.string(),
});

export const ShowcaseProtectedStubSchema = z.object({
  storyId: z.string(),
  protected: z.literal(true),
});

export const UnlockShowcaseStoryRequestSchema = z.object({
  password: z.string().min(1).max(200),
});

export type CreatePublicationRequest = z.infer<typeof CreatePublicationRequestSchema>;
export type UpdateShowcaseVisibilityRequest = z.infer<typeof UpdateShowcaseVisibilityRequestSchema>;
export type UnlockShowcaseStoryRequest = z.infer<typeof UnlockShowcaseStoryRequestSchema>;

/** `2026-08-19`, no fuso local de quem publica (o servidor). */
function formatDatePart(publishedAt: Date): string {
  const year = publishedAt.getFullYear();
  const month = String(publishedAt.getMonth() + 1).padStart(2, '0');
  const day = String(publishedAt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Monta o nome de uma versão no estilo que o dono escolheu.
 *
 * `version` e `both` carregam `operationVersion`, que é monotônico por história - não colidem.
 * `date` colide de verdade (duas publicações no mesmo dia), e aí ganha sufixo: `2026-08-19`,
 * depois `2026-08-19-02`, `-03`... O sufixo sai de `existingLabels` em vez de uma consulta,
 * para esta função continuar pura e o servidor poder chamá-la dentro da transação que já
 * segurou as labels existentes daquela história.
 */
export function buildPublicationLabel(
  mode: z.infer<typeof PublicationLabelModeSchema>,
  operationVersion: number,
  publishedAt: Date,
  existingLabels: string[],
): string {
  const datePart = formatDatePart(publishedAt);
  const base =
    mode === 'version'
      ? `v${operationVersion}`
      : mode === 'date'
        ? datePart
        : `v${operationVersion}-${datePart}`;

  const taken = new Set(existingLabels);
  if (!taken.has(base)) {
    return base;
  }
  // Começa em 02: a primeira do dia é a que já está lá, sem sufixo.
  for (let suffix = 2; suffix < 1000; suffix++) {
    const candidate = `${base}-${String(suffix).padStart(2, '0')}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Could not build a unique publication label from "${base}".`);
}
