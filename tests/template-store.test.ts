import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  exportTemplate,
  importTemplate,
  TemplateImportError,
  templateStore,
} from "@/lib/report/template-store";
import { emptyTemplate, TEMPLATE_JSON_VERSION } from "@/lib/report/types";

// jsdom gives us localStorage; clear between tests.
beforeEach(() => {
  localStorage.clear();
});

// crypto.randomUUID may be missing in some environments; polyfill minimally.
if (!("randomUUID" in crypto)) {
  (crypto as unknown as { randomUUID: () => string }).randomUUID = () =>
    `uuid-${Math.random().toString(36).slice(2)}`;
}

describe("templateStore", () => {
  it("save → list round-trips templates per-project", () => {
    const t = emptyTemplate("project-A");
    templateStore.save("project-A", t);
    const list = templateStore.list("project-A");
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(t.id);
    // Different project — no bleed.
    expect(templateStore.list("project-B")).toHaveLength(0);
  });

  it("save upserts by id (same id overwrites, new id appends)", () => {
    const t = emptyTemplate("p");
    templateStore.save("p", t);
    templateStore.save("p", { ...t, name: "Renamed" });
    const list = templateStore.list("p");
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe("Renamed");

    const t2 = emptyTemplate("p");
    templateStore.save("p", t2);
    expect(templateStore.list("p")).toHaveLength(2);
  });

  it("remove deletes a template by id", () => {
    const t = emptyTemplate("p");
    templateStore.save("p", t);
    templateStore.remove("p", t.id);
    expect(templateStore.list("p")).toHaveLength(0);
  });

  it("tolerates corrupt storage data", () => {
    localStorage.setItem("forma-rfi.templates.p", "not json");
    expect(templateStore.list("p")).toEqual([]);
  });
});

describe("export / import", () => {
  it("export → import round-trips a template", () => {
    const t = emptyTemplate("p");
    const json = exportTemplate(t);
    const restored = importTemplate(json);
    expect(restored.id).toBe(t.id);
    expect(restored.name).toBe(t.name);
  });

  it("import rejects non-JSON", () => {
    expect(() => importTemplate("<html>")).toThrow(TemplateImportError);
  });

  it("import rejects envelopes from a different schema", () => {
    const bad = JSON.stringify({ $schema: "other", version: 1, template: {} });
    expect(() => importTemplate(bad)).toThrow(/not a forma/i);
  });

  it("import rejects unsupported schema versions", () => {
    const bad = JSON.stringify({
      $schema: "forma-rfi-report-template",
      version: TEMPLATE_JSON_VERSION + 99,
      template: emptyTemplate("p"),
    });
    expect(() => importTemplate(bad)).toThrow(/version/i);
  });

  it("import rejects envelopes missing required template fields", () => {
    const bad = JSON.stringify({
      $schema: "forma-rfi-report-template",
      version: TEMPLATE_JSON_VERSION,
      template: { id: "x", name: "x" },
    });
    expect(() => importTemplate(bad)).toThrow(/missing/i);
  });
});

describe("crypto.randomUUID integration", () => {
  it("emptyTemplate yields unique ids per call", () => {
    const a = emptyTemplate("p");
    const b = emptyTemplate("p");
    expect(a.id).not.toBe(b.id);
    expect(vi.isMockFunction(crypto.randomUUID)).toBe(false);
  });
});
