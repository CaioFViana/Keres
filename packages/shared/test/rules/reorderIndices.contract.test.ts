import { describe, expect, it } from "vitest";
import {
  buildReorderItems,
  completeReorderProblem,
  inspectContiguousOneBasedIndexes,
  reorderIndicesProblem,
} from "../../rules/reorderIndices";

describe("reorder index rules", () => {
  it("classifies every persisted contiguous-index failure", () => {
    expect(inspectContiguousOneBasedIndexes([])).toBeNull();
    expect(inspectContiguousOneBasedIndexes([1, 1])).toBe("duplicate");
    expect(inspectContiguousOneBasedIndexes([2, 3])).toBe("start");
    expect(inspectContiguousOneBasedIndexes([1, 3])).toBe("gap");
    expect(inspectContiguousOneBasedIndexes([3, 1, 2])).toBeNull();
  });

  it("creates and validates full, contiguous reorder payloads", () => {
    const items = buildReorderItems(["b", "a"], (id) => id);
    expect(items).toEqual([
      { id: "b", newIndex: 1 },
      { id: "a", newIndex: 2 },
    ]);
    expect(reorderIndicesProblem([])).toBeNull();
    expect(reorderIndicesProblem([1, 1])).toMatch(/Duplicate/);
    expect(reorderIndicesProblem([1, 3])).toMatch(/sequential/);
    expect(completeReorderProblem(["a", "b"], items)).toBeNull();
    expect(
      completeReorderProblem(["a", "b"], [{ id: "a", newIndex: 1 }]),
    ).toMatch(/every expected/);
  });
});
