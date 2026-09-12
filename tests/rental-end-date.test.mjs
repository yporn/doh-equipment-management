import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

for (const path of ["app/api/rentals/route.ts", "app/rentals/page.tsx"]) {
  test(`inclusive rental end date in ${path}`, async () => {
    const source = await readFile(new URL("../" + path, import.meta.url), "utf8");
    const functionSource = source.match(/function calculateEndDate\([\s\S]*?\n\}/)?.[0];
    assert.ok(functionSource);
    const js = ts.transpileModule(functionSource, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const calculate = vm.runInNewContext(js + "\ncalculateEndDate");
    for (const [start, duration, unit, end] of [
      ["2026-09-04", 1, "DAILY", "2026-09-04"],
      ["2026-09-04", 3, "DAILY", "2026-09-06"],
      ["2026-09-04", 1, "WEEKLY", "2026-09-10"],
      ["2026-09-01", 1, "MONTHLY", "2026-09-30"],
      ["2026-09-04", 1, "MONTHLY", "2026-10-03"],
      ["2026-09-04", 1, "YEARLY", "2027-09-03"],
      ["2026-12-31", 2, "DAILY", "2027-01-01"],
      ["2024-02-01", 1, "MONTHLY", "2024-02-29"],
      ["2026-02-01", 1, "MONTHLY", "2026-02-28"],
    ]) assert.equal(calculate(start, duration, unit), end);
  });
}
