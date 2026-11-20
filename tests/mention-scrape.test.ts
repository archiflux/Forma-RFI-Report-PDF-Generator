import { describe, expect, it } from "vitest";
import {
  mergeRosters,
  renderCommentBody,
  scrapeMentionRoster,
} from "@/lib/aps/users";
import type { Rfi } from "@/lib/aps/types";

function makeRfi(comments: { body: string }[]): Rfi {
  return {
    id: "r1",
    number: "RFI-1",
    title: "t",
    status: "open",
    createdAt: "",
    assignees: [],
    ballInCourt: [],
    coReviewers: [],
    distributionList: [],
    watchers: [],
    customAttributes: {},
    attachments: [],
    attachmentCount: 0,
    extra: {},
    comments: comments.map((c, i) => ({ id: `c${i}`, body: c.body, attachments: [] })),
  };
}

describe("mention-scraped roster", () => {
  it("harvests id → name from @{...} mentions in comment bodies", () => {
    const rfi = makeRfi([
      {
        body:
          'Hey @{"type": "user", "id": "ABC123", "name": "Richard Bowdler"} please review',
      },
    ]);
    const roster = scrapeMentionRoster([rfi]);
    expect(roster.get("ABC123")).toBe("Richard Bowdler");
  });

  it("keeps the first name seen for an id (earliest wins)", () => {
    const rfi = makeRfi([
      { body: 'first @{"type":"user","id":"X","name":"Alice"}' },
      { body: 'later  @{"type":"user","id":"X","name":"Alice (Removed)"}' },
    ]);
    const roster = scrapeMentionRoster([rfi]);
    expect(roster.get("X")).toBe("Alice");
  });

  it("ignores malformed mention JSON without crashing", () => {
    const rfi = makeRfi([
      { body: "garbage @{broken json here}" },
      { body: 'good @{"type":"user","id":"Y","name":"Bob"}' },
    ]);
    const roster = scrapeMentionRoster([rfi]);
    expect(roster.get("Y")).toBe("Bob");
    expect(roster.size).toBe(1);
  });

  it("merges rosters with the primary winning ties", () => {
    const primary = new Map([["X", "Primary name"]]);
    const fallback = new Map([
      ["X", "Fallback name"],
      ["Y", "Other"],
    ]);
    const merged = mergeRosters(primary, fallback);
    expect(merged.get("X")).toBe("Primary name");
    expect(merged.get("Y")).toBe("Other");
  });
});

describe("renderCommentBody", () => {
  it("replaces mention blobs with @Name tokens", () => {
    expect(
      renderCommentBody(
        'Hi @{"type":"user","id":"X","name":"Richard Bowdler"} please help',
      ),
    ).toBe("Hi @Richard Bowdler please help");
  });

  it("falls back to @<id> when the mention has no name", () => {
    expect(renderCommentBody('ping @{"type":"user","id":"XYZ"}')).toBe("ping @XYZ");
  });

  it("drops malformed mention blobs", () => {
    expect(renderCommentBody("broken @{not json} rest")).toBe("broken  rest");
  });

  it("returns an empty string for an undefined body", () => {
    expect(renderCommentBody(undefined)).toBe("");
  });
});
