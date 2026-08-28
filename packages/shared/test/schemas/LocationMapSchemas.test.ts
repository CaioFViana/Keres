import { describe, expect, it } from 'vitest';
import {
  CreateLocationMapDataSchema,
  LocationMapContentSchema,
  generateLocationMapLocalId,
  remapLocationMapContent,
} from '../../schemas/LocationMapSchemas';

const imageId = '01ABCDEF';
const nodeId = '02GHJKMN';

describe('LocationMapContentSchema', () => {
  it('accepts an empty map', () => {
    expect(LocationMapContentSchema.parse({ images: [], nodes: [] })).toEqual({
      images: [],
      nodes: [],
    });
  });

  it('defaults a new map to an empty drawing', () => {
    expect(CreateLocationMapDataSchema.parse({ name: 'Continente' })).toMatchObject({
      name: 'Continente',
      description: null,
      content: { images: [], nodes: [] },
    });
  });

  it('accepts images and nodes with their ids', () => {
    const content = LocationMapContentSchema.parse({
      images: [
        { id: imageId, galleryId: 'gallery-1', x: 0, y: 0, width: 320, height: 240 },
      ],
      nodes: [{ id: nodeId, locationId: 'location-1', x: 100, y: 100, icon: 'pin' }],
    });
    expect(content.images).toHaveLength(1);
    expect(content.nodes).toHaveLength(1);
  });

  it('rejects duplicate image ids', () => {
    expect(() =>
      LocationMapContentSchema.parse({
        images: [
          { id: imageId, galleryId: 'gallery-1', x: 0, y: 0, width: 320, height: 240 },
          { id: imageId, galleryId: 'gallery-2', x: 10, y: 10, width: 320, height: 240 },
        ],
        nodes: [],
      }),
    ).toThrow(/Duplicate image id/);
  });

  it('rejects duplicate node ids', () => {
    expect(() =>
      LocationMapContentSchema.parse({
        images: [],
        nodes: [
          { id: nodeId, locationId: 'location-1', x: 0, y: 0, icon: 'pin' },
          { id: nodeId, locationId: 'location-2', x: 10, y: 10, icon: 'flag' },
        ],
      }),
    ).toThrow(/Duplicate node id/);
  });

  it('rejects a non-positive image size', () => {
    expect(() =>
      LocationMapContentSchema.parse({
        images: [{ id: imageId, galleryId: 'gallery-1', x: 0, y: 0, width: 0, height: 240 }],
        nodes: [],
      }),
    ).toThrow();
  });
});

describe('remapLocationMapContent', () => {
  it('rewrites gallery and location ids, keeping local ids', () => {
    const remapped = remapLocationMapContent(
      {
        images: [{ id: imageId, galleryId: 'gallery-1', x: 0, y: 0, width: 320, height: 240 }],
        nodes: [{ id: nodeId, locationId: 'location-1', x: 100, y: 100, icon: 'pin' }],
      },
      (id) => `${id}-copy`,
    );

    expect(remapped.images[0]).toMatchObject({ id: imageId, galleryId: 'gallery-1-copy' });
    expect(remapped.nodes[0]).toMatchObject({ id: nodeId, locationId: 'location-1-copy' });
  });
});

describe('generateLocationMapLocalId', () => {
  it('allocates an id that is not in the existing set', () => {
    const id = generateLocationMapLocalId(new Set([imageId]));

    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(id).not.toBe(imageId);
  });
});