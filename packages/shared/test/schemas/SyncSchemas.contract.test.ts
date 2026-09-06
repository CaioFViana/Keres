import { describe, expect, it } from "vitest";
import {
  MAX_SYNC_BATCH_SIZE,
  MAX_SYNC_PULL_BATCH,
  omitSyncImmutableFields,
  UlidSchema,
} from "../../schemas/SyncSchemas";

describe("sync schema helpers", () => {
  it("keeps mutable changes while stripping every protocol-owned field", () => {
    expect(
      omitSyncImmutableFields({
        id: "x",
        storyId: "s",
        version: 2,
        title: "New",
        extra: null,
      }),
    ).toEqual({ title: "New", extra: null });
    expect(UlidSchema.safeParse("01ARZ3NDEKTSV4RRFFQ69G5FAV").success).toBe(
      true,
    );
    expect(UlidSchema.safeParse("invalid").success).toBe(false);
    expect(MAX_SYNC_BATCH_SIZE).toBe(200);
    expect(MAX_SYNC_PULL_BATCH).toBe(500);
  });
});
