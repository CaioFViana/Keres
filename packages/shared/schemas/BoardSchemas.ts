import { z } from 'zod';
import { isSpatialEnvelopeSafe } from '../graphs/spatialCanvas';

/**
 * A Board is a named drawing: pins of existing entities, free notes, and arrows that are not
 * story relations. Nodes and edges are never edited independently, so they travel as one JSON
 * document — the same reason a calendar's months are not five child tables.
 *
 * Last-write-wins on `content` as a whole is the conflict unit. Two layouts of the same graph
 * cannot be merged field by field; the review sheet offers keep-mine, keep-server, or clone.
 */

export const BOARD_PIN_ENTITIES = [
  'Character',
  'Location',
  'Note',
  'Scene',
  'Item',
  'Gallery',
  'Chapter',
  'WorldRule',
  'Board',
] as const;
export type BoardPinEntity = (typeof BOARD_PIN_ENTITIES)[number];

/** Crockford (ULID alphabet), 8 chars — unique inside one board, not globally. */
export const BOARD_LOCAL_ID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const BOARD_LOCAL_ID_LENGTH = 8;
export const BOARD_LOCAL_ID_REGEX = /^[0-9A-HJKMNP-TV-Z]{8}$/;

export const MAX_BOARD_NODES = 500;
export const MAX_BOARD_EDGES = 1000;
const BOARD_MAX_NODE_EXTENT = 720;
export const BOARD_CARD_DISPLAY_MODES = ['compact', 'summary', 'note', 'summary-and-note'] as const;
export type BoardCardDisplayMode = (typeof BOARD_CARD_DISPLAY_MODES)[number];

const BoardLocalIdSchema = z
  .string()
  .regex(BOARD_LOCAL_ID_REGEX, 'Board node and edge ids are 8 Crockford characters');

export function generateBoardLocalId(existing: ReadonlySet<string>): string {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    let id = '';
    for (let index = 0; index < BOARD_LOCAL_ID_LENGTH; index += 1) {
      const pick = Math.floor(Math.random() * BOARD_LOCAL_ID_ALPHABET.length);
      id += BOARD_LOCAL_ID_ALPHABET[pick];
    }
    if (!existing.has(id)) return id;
  }
  throw new Error('Could not allocate a unique board-local id.');
}

const BoardEntityNodeSchema = z.object({
  id: BoardLocalIdSchema,
  kind: z.literal('entity'),
  x: z.number().finite(),
  y: z.number().finite(),
  entityType: z.enum(BOARD_PIN_ENTITIES),
  entityId: z.string().min(1),
  labelAtPin: z.string().max(200),
  /** Presentation belongs to this Board pin, not to the linked story entity. */
  displayMode: z.enum(BOARD_CARD_DISPLAY_MODES).default('compact'),
  /** A contextual note for this pin; it deliberately does not create a Note entity. */
  cardNote: z.string().max(8000).nullable().default(null),
  /** Optional manual dimensions keep older compact pins visually unchanged. */
  width: z.number().finite().min(148).max(720).optional(),
  height: z.number().finite().min(86).max(720).optional(),
  /** Visual stacking order inside this Board; absent values preserve older document order. */
  zIndex: z.number().finite().optional(),
});

const BoardNoteNodeSchema = z.object({
  id: BoardLocalIdSchema,
  kind: z.literal('note'),
  x: z.number().finite(),
  y: z.number().finite(),
  title: z.string().max(200),
  body: z.string().max(8000).nullable(),
  width: z.number().finite().min(148).max(720).optional(),
  height: z.number().finite().min(86).max(720).optional(),
  zIndex: z.number().finite().optional(),
});

export const BoardNodeSchema = z.discriminatedUnion('kind', [
  BoardEntityNodeSchema,
  BoardNoteNodeSchema,
]);

export const BoardEdgeSchema = z.object({
  id: BoardLocalIdSchema,
  from: BoardLocalIdSchema,
  to: BoardLocalIdSchema,
  directed: z.boolean(),
  label: z.string().max(200).nullable(),
});

export const EMPTY_BOARD_CONTENT = { nodes: [], edges: [] } as const;

export const BoardContentSchema = z
  .object({
    nodes: z.array(BoardNodeSchema).max(MAX_BOARD_NODES),
    edges: z.array(BoardEdgeSchema).max(MAX_BOARD_EDGES),
  })
  .superRefine((content, context) => {
    const nodeIds = new Set<string>();
    for (const [index, node] of content.nodes.entries()) {
      if (nodeIds.has(node.id)) {
        context.addIssue({
          code: 'custom',
          path: ['nodes', index, 'id'],
          message: 'Duplicate node id on this board.',
        });
      }
      nodeIds.add(node.id);
    }

    const edgeIds = new Set<string>();
    const edgePairs = new Set<string>();
    for (const [index, edge] of content.edges.entries()) {
      if (edgeIds.has(edge.id)) {
        context.addIssue({
          code: 'custom',
          path: ['edges', index, 'id'],
          message: 'Duplicate edge id on this board.',
        });
      }
      edgeIds.add(edge.id);
      const pair = [edge.from, edge.to].sort().join(':');
      if (edgePairs.has(pair)) {
        context.addIssue({
          code: 'custom',
          path: ['edges', index],
          message: 'A board can only have one connection between the same two nodes.',
        });
      }
      edgePairs.add(pair);
      if (!nodeIds.has(edge.from)) {
        context.addIssue({
          code: 'custom',
          path: ['edges', index, 'from'],
          message: 'Edge refers to a node that is not on this board.',
        });
      }
      if (!nodeIds.has(edge.to)) {
        context.addIssue({
          code: 'custom',
          path: ['edges', index, 'to'],
          message: 'Edge refers to a node that is not on this board.',
        });
      }
    }
    // A freeform Board may be large, but an unbounded JSON coordinate would make exports and
    // geometry unsafe even after the interactive canvas becomes virtualized.
    if (
      !isSpatialEnvelopeSafe(
        content.nodes.map((node) => ({
          x: node.x,
          y: node.y,
          width: node.width ?? BOARD_MAX_NODE_EXTENT,
          height: node.height ?? BOARD_MAX_NODE_EXTENT,
        })),
      )
    ) {
      context.addIssue({
        code: 'custom',
        path: ['nodes'],
        message: 'Board nodes exceed the supported spatial canvas envelope.',
      });
    }
  });

/** The one runtime boundary for a Board's JSON document, shared by client and server. */
export function validateBoardContent(content: unknown) {
  return BoardContentSchema.parse(content);
}

export const BoardSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable(),
  content: BoardContentSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateBoardDataSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().default(null),
  content: BoardContentSchema.default({ nodes: [], edges: [] }),
});

export const PartialBoardSchema = CreateBoardDataSchema.partial();

/** Input types keep drawings created before optional presentation settings valid in callers. */
export type BoardNodeType = z.input<typeof BoardNodeSchema>;
export type BoardEdgeType = z.infer<typeof BoardEdgeSchema>;
export type BoardContentType = z.input<typeof BoardContentSchema>;
export type BoardRowType = z.infer<typeof BoardSchema>;
export type CreateBoardDataType = z.infer<typeof CreateBoardDataSchema>;
export type PartialBoardType = z.infer<typeof PartialBoardSchema>;

/**
 * Rewrites `entityId` on entity pins after a story clone/import. Node and edge ids stay:
 * they are local to this JSON, not rows in the id map. Unmapped ids (a ghost pin) stay as they
 * were — the pin remains a ghost in the copy too.
 */
export function remapBoardContent(
  content: BoardContentType,
  remapId: (id: string) => string,
): z.infer<typeof BoardContentSchema> {
  return {
    nodes: content.nodes.map((node) =>
      node.kind === 'entity'
        ? {
            ...node,
            entityId: remapId(node.entityId),
            displayMode: node.displayMode ?? 'compact',
            cardNote: node.cardNote ?? null,
          }
        : node,
    ),
    edges: content.edges,
  };
}
