import { describe, expect, it } from "vitest";
import { MAX_INLINE, readSelection, selectionKey, writeSelection } from "./selection-url";

function memStore(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}

const id = (i: number) => `b.${String(i).padStart(8, "0")}-aaaa-bbbb-cccc-dddddddddddd`;

describe("project selection in the address", () => {
  it("keeps a short selection in ?p", () => {
    const store = memStore();
    const params = new URLSearchParams("hubId=h");
    writeSelection(params, [id(1), id(2)], store);
    expect(params.get("p")).toBe(`${id(1)},${id(2)}`);
    expect(readSelection(params, store)).toEqual([id(1), id(2)]);
  });

  it("swaps a long selection for a short stored key", () => {
    const store = memStore();
    const ids = Array.from({ length: 1300 }, (_, i) => id(i));
    const params = new URLSearchParams("hubId=h&p=old");
    writeSelection(params, ids, store);
    expect(params.get("p")).toBeNull();
    expect(params.toString().length).toBeLessThan(100);
    expect(ids.join(",").length).toBeGreaterThan(MAX_INLINE);
    expect(readSelection(params, store)).toEqual(ids);
  });

  it("gives the same key for the same projects in any order", () => {
    expect(selectionKey([id(1), id(2)])).toBe(selectionKey([id(2), id(1)]));
  });

  it("clears the selection", () => {
    const params = new URLSearchParams("hubId=h&sel=x");
    writeSelection(params, [], memStore());
    expect(params.toString()).toBe("hubId=h");
  });
});
