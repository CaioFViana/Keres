import { expect, it } from "vitest";
import { isProtectedStub } from "../../entities/PublicShowcaseStory";

it("recognizes the deliberately minimal protected showcase response", () => {
  expect(isProtectedStub({ storyId: "story", protected: true })).toBe(true);
  expect(isProtectedStub({ storyId: "story", protected: false } as never)).toBe(
    false,
  );
});
