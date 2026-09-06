import { expect, it } from "vitest";
import {
  isSameEntity,
  sortEntityPair,
  sortIdPair,
} from "../../rules/entityPair";

it("canonicalizes unordered pairs and recognizes identical endpoints", () => {
  expect(
    sortEntityPair(
      { type: "Location", id: "b" },
      { type: "Character", id: "a" },
    ),
  ).toEqual([
    { type: "Character", id: "a" },
    { type: "Location", id: "b" },
  ]);
  expect(sortIdPair("b", "a")).toEqual(["a", "b"]);
  expect(
    isSameEntity(
      { type: "Character", id: "a" },
      { type: "Character", id: "a" },
    ),
  ).toBe(true);
});
