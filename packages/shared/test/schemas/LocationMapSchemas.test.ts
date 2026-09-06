import { describe, expect, it } from "vitest";
import {
  CreateLocationMapDataSchema,
  LocationMapContentSchema,
  generateLocationMapLocalId,
  remapLocationMapContent,
  validateLocationMapContent,
} from "../../schemas/LocationMapSchemas";

const imageId = "01ABCDEF";
const nodeId = "02GHJKMN";

describe("LocationMapContentSchema", () => {
  it("accepts an empty map", () => {
    expect(validateLocationMapContent({ images: [], nodes: [] })).toEqual({
      images: [],
      nodes: [],
    });
  });

  it("rejects a map whose image leaves the shared spatial envelope", () => {
    expect(() =>
      LocationMapContentSchema.parse({
        images: [
          {
            id: imageId,
            galleryId: "gallery-1",
            x: 100_000,
            y: 0,
            width: 320,
            height: 240,
          },
        ],
        nodes: [],
      }),
    ).toThrow(/spatial canvas envelope/);
  });

  it("defaults a new map to an empty drawing", () => {
    expect(
      CreateLocationMapDataSchema.parse({ name: "Continente" }),
    ).toMatchObject({
      name: "Continente",
      description: null,
      content: { images: [], nodes: [] },
    });
  });

  it("accepts images and nodes with their ids", () => {
    const content = LocationMapContentSchema.parse({
      images: [
        {
          id: imageId,
          galleryId: "gallery-1",
          x: 0,
          y: 0,
          width: 320,
          height: 240,
        },
      ],
      nodes: [
        { id: nodeId, locationId: "location-1", x: 100, y: 100, icon: "pin" },
      ],
    });
    expect(content.images).toHaveLength(1);
    expect(content.nodes).toHaveLength(1);
  });

  it("defaults a node color so older maps without it keep parsing", () => {
    const content = LocationMapContentSchema.parse({
      images: [],
      nodes: [
        { id: nodeId, locationId: "location-1", x: 100, y: 100, icon: "pin" },
      ],
    });
    expect(content.nodes[0].color).toBe("#8BC34A");
  });

  it("defaults an image locked flag so older maps without it keep parsing", () => {
    const content = LocationMapContentSchema.parse({
      images: [
        {
          id: imageId,
          galleryId: "gallery-1",
          x: 0,
          y: 0,
          width: 320,
          height: 240,
        },
      ],
      nodes: [],
    });
    expect(content.images[0].locked).toBe(false);
  });

  it("accepts free markers and optional map destinations", () => {
    const content = LocationMapContentSchema.parse({
      images: [],
      nodes: [
        {
          id: nodeId,
          locationId: "location-1",
          x: 100,
          y: 100,
          icon: "pin",
          destinationMapId: "map-2",
        },
      ],
      markers: [
        {
          id: imageId,
          x: 20,
          y: 30,
          title: "Hidden key",
          icon: "key",
          destinationMapId: null,
        },
      ],
    });
    expect(content.markers?.[0]).toMatchObject({
      title: "Hidden key",
      destinationMapId: null,
    });
    expect(content.nodes[0].destinationMapId).toBe("map-2");
  });

  it("rejects duplicate image ids", () => {
    expect(() =>
      LocationMapContentSchema.parse({
        images: [
          {
            id: imageId,
            galleryId: "gallery-1",
            x: 0,
            y: 0,
            width: 320,
            height: 240,
          },
          {
            id: imageId,
            galleryId: "gallery-2",
            x: 10,
            y: 10,
            width: 320,
            height: 240,
          },
        ],
        nodes: [],
      }),
    ).toThrow(/Duplicate image id/);
  });

  it("rejects duplicate node ids", () => {
    expect(() =>
      LocationMapContentSchema.parse({
        images: [],
        nodes: [
          { id: nodeId, locationId: "location-1", x: 0, y: 0, icon: "pin" },
          { id: nodeId, locationId: "location-2", x: 10, y: 10, icon: "flag" },
        ],
      }),
    ).toThrow(/Duplicate node id/);
  });

  it("rejects a non-positive image size", () => {
    expect(() =>
      LocationMapContentSchema.parse({
        images: [
          {
            id: imageId,
            galleryId: "gallery-1",
            x: 0,
            y: 0,
            width: 0,
            height: 240,
          },
        ],
        nodes: [],
      }),
    ).toThrow();
  });

  it("rejects duplicate locations, marker identities, relation labels, and invalid marker edges", () => {
    const base = {
      images: [],
      nodes: [
        { id: nodeId, locationId: "location-1", x: 0, y: 0, icon: "pin" },
      ],
    };
    expect(() =>
      LocationMapContentSchema.parse({
        ...base,
        nodes: [
          ...base.nodes,
          { id: "03PQRSTV", locationId: "location-1", x: 1, y: 1, icon: "pin" },
        ],
      }),
    ).toThrow(/location can only appear/);
    expect(() =>
      LocationMapContentSchema.parse({
        ...base,
        markers: [{ id: nodeId, x: 0, y: 0, title: "Gate", icon: "flag" }],
      }),
    ).toThrow(/Duplicate node or marker/);
    expect(() =>
      LocationMapContentSchema.parse({
        ...base,
        relationTexts: [
          { sourceLocationId: "a", destinationLocationId: "b", text: "Road" },
          { sourceLocationId: "a", destinationLocationId: "b", text: "Other" },
        ],
      }),
    ).toThrow(/Duplicate relation text/);
    expect(() =>
      LocationMapContentSchema.parse({
        ...base,
        markerConnections: [
          { id: imageId, fromId: nodeId, toId: nodeId, directed: true },
        ],
      }),
    ).toThrow(/two different points/);
  });
});

describe("remapLocationMapContent", () => {
  it("rewrites gallery and location ids, keeping local ids", () => {
    const remapped = remapLocationMapContent(
      {
        images: [
          {
            id: imageId,
            galleryId: "gallery-1",
            x: 0,
            y: 0,
            width: 320,
            height: 240,
            locked: false,
          },
        ],
        nodes: [
          {
            id: nodeId,
            locationId: "location-1",
            x: 100,
            y: 100,
            icon: "pin",
            color: "#8BC34A",
          },
        ],
      },
      (id) => `${id}-copy`,
    );

    expect(remapped.images[0]).toMatchObject({
      id: imageId,
      galleryId: "gallery-1-copy",
    });
    expect(remapped.nodes[0]).toMatchObject({
      id: nodeId,
      locationId: "location-1-copy",
    });
  });

  it("also rewrites map destinations and keeps free marker text", () => {
    const remapped = remapLocationMapContent(
      {
        images: [],
        nodes: [
          {
            id: nodeId,
            locationId: "location-1",
            x: 0,
            y: 0,
            icon: "pin",
            color: "#8BC34A",
            destinationMapId: "map-1",
          },
        ],
        markers: [
          {
            id: imageId,
            x: 0,
            y: 0,
            title: "Gate",
            icon: "flag",
            color: "#8BC34A",
            destinationMapId: "map-2",
          },
        ],
      },
      (id) => `${id}-copy`,
    );
    expect(remapped.nodes[0].destinationMapId).toBe("map-1-copy");
    expect(remapped.markers?.[0]).toMatchObject({
      title: "Gate",
      destinationMapId: "map-2-copy",
    });
  });

  it("rewrites relation text endpoints while retaining marker connection identity", () => {
    const remapped = remapLocationMapContent(
      {
        images: [],
        nodes: [],
        relationTexts: [
          { sourceLocationId: "a", destinationLocationId: "b", text: "Road" },
        ],
        markerConnections: [
          {
            id: imageId,
            fromId: nodeId,
            toId: "03PQRSTV",
            directed: true,
            label: null,
          },
        ],
      },
      (id) => `${id}-copy`,
    );
    expect(remapped.relationTexts).toEqual([
      {
        sourceLocationId: "a-copy",
        destinationLocationId: "b-copy",
        text: "Road",
      },
    ]);
    expect(remapped.markerConnections?.[0]).toMatchObject({
      id: imageId,
      fromId: nodeId,
    });
  });
});

describe("generateLocationMapLocalId", () => {
  it("allocates an id that is not in the existing set", () => {
    const id = generateLocationMapLocalId(new Set([imageId]));

    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(id).not.toBe(imageId);
  });
});
