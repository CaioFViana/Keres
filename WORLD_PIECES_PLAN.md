# World Pieces

## Decision

Keres will replace the narrowly named `WorldRule` with one persistent, story-owned
entity: `WorldPiece`. Existing World Rules are preserved and become World Pieces
in the **Rules** section. This is a rename and extension of one model, not four
parallel entity types; existing pieces therefore keep their IDs and their related
data.

## Purpose

World Pieces make a connected world bible possible for novels, comics, games,
screenplays, campaigns and other narrative media. They describe concepts which
are not already better represented by Character, Location or Item: creatures,
flora, myths, collective cultures and world knowledge alongside the world rules
already supported by Keres.

## Model

`WorldPiece` has the normal story entity lifecycle (`id`, `storyId`, dates,
version and tombstone) plus:

- `section`: a fixed drawer-organising value: `rule`, `fauna`, `flora`,
  `mythology`, `people`, `knowledge` or `other`;
- `type`: optional free text, offered from the section-scoped suggestion catalogue;
- `name`, `description`, `category`, `behavior`, `usability`, `danger`,
  `isFavorite` and `extraNotes`.

The fixed Section keeps the drawer legible. The optional Type remains owned by
the author: for example, fauna can have creature/species/monster and people can
have culture/clan/nation. Type suggestions are isolated by Section through
catalogue keys such as `world_piece_type:flora`. Switching Section clears a Type
that belongs to the previous catalogue after an explicit form warning.

## Relationships

There is no `WorldPieceLocation` join table in the first release. A location is
related to a World Piece through the existing reciprocal **See also** relation,
as are World Pieces to one another and to other navigable story entities. This
avoids two generic relationship mechanisms. A dedicated location relation is a
future option only if Keres needs semantics such as *habitat*, *origin* or
*cultivated in*, or first-class geographic filtering.

`WorldPiece` is a valid target of an Entity Story Schema attribute. This permits
structured one-way links such as a character's species, an item's mythical origin
or a creature's natural predator without imposing extra native columns.

## Lifecycle and compatibility

The rework covers local and server schemas/migrations, shared Zod contracts,
operation logs and handlers, import/export/clone, favorites, tags, notes,
comments, see-also, custom attributes, search, boards, navigation, help and
example data. The migration retains the existing `world_rules` table name during
the first compatibility release while the public, shared and UI entity name is
`WorldPiece`; this makes existing installations and server data migratable without
copying rows or breaking references.

## Drawer

The drawer entry becomes **World** and opens an index in the style of
Customization. It exposes section cards with counts. Each card opens one common
World Piece list filtered by Section. No separate CRUD stacks are introduced.

## Deferred decisions

- A semantic WorldPiece ↔ Location relation.
- Multiple sections per piece.
- A separate item/artefact section; Item already owns that responsibility.
