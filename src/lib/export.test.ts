import { describe, it, expect } from "vitest";
import { safeName } from "./export";

describe("export.safeName", () => {
  it("keeps Thai and alphanumeric", () => {
    expect(safeName("SOP ทดสอบ 01")).toMatch(/SOP/);
    expect(safeName("SOP ทดสอบ 01")).toMatch(/ทดสอบ/);
  });

  it("replaces unsafe characters", () => {
    const n = safeName("a/b:c*d");
    expect(n).not.toMatch(/[\/:*]/);
  });

  it("falls back when empty", () => {
    expect(safeName("")).toBe("document");
    expect(safeName("!!!")).toBe("document");
  });
});
