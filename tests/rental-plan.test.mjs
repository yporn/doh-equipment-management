import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { FISCAL_MONTHS, percentUsed, planStatus, summarizeRentalPlans } from "../lib/rental-plan.mjs";

test("summarizeRentalPlans merges plans and actual rentals per department for one fiscal year", () => {
  const plans = [
    { department: "โครงการ ก", fiscalYear: 2569, planAmount: 120000 },
    { department: "โครงการ ก", fiscalYear: 2570, planAmount: 999999 }, // a different fiscal year — must be ignored
    { department: "โครงการ ค", fiscalYear: 2569, planAmount: 50000 }, // has a plan but no rentals at all
  ];
  const rentals = [
    // Exactly a 1-year contract aligned to the fiscal year: reconciles to precisely 120000 across all 12 months.
    { renterName: "โครงการ ก", startDate: "2025-10-01", expectedReturnDate: "2026-09-30", rateType: "YEARLY", duration: 1, totalAmount: 120000 },
    // A 3-month contract starting on the 1st, so it touches exactly its own 3 nominal months.
    { renterName: "โครงการ ข", startDate: "2026-01-01", expectedReturnDate: "2026-03-31", rateType: "MONTHLY", duration: 3, totalAmount: 9000 },
    // Outside the fiscal year entirely — must not contribute anything.
    { renterName: "โครงการ ก", startDate: "2027-10-01", expectedReturnDate: "2028-09-30", rateType: "YEARLY", duration: 1, totalAmount: 999999 },
  ];

  const summary = summarizeRentalPlans(rentals, plans, 2569);
  const byDept = Object.fromEntries(summary.map((entry) => [entry.department, entry]));

  assert.equal(summary.length, 3);
  assert.equal(byDept["โครงการ ก"].plan, 120000);
  assert.equal(byDept["โครงการ ก"].actual, 120000);
  assert.equal(byDept["โครงการ ก"].remaining, 0);
  assert.equal(byDept["โครงการ ก"].percent, 100);
  assert.equal(byDept["โครงการ ก"].monthly.length, FISCAL_MONTHS.length);
  assert.equal(byDept["โครงการ ก"].monthly.reduce((a, b) => a + b, 0), 120000);

  // No plan was ever set for this department — spending against zero budget is flagged, not divided by zero.
  assert.equal(byDept["โครงการ ข"].plan, 0);
  assert.equal(byDept["โครงการ ข"].actual, 9000);
  assert.equal(byDept["โครงการ ข"].remaining, -9000);
  assert.equal(byDept["โครงการ ข"].percent, Infinity);

  // A plan with no rentals yet still shows up, at 0% used.
  assert.equal(byDept["โครงการ ค"].plan, 50000);
  assert.equal(byDept["โครงการ ค"].actual, 0);
  assert.equal(byDept["โครงการ ค"].remaining, 50000);
  assert.equal(byDept["โครงการ ค"].percent, 0);

  // Sorted by percent used, descending, so over-budget departments surface first.
  assert.deepEqual(summary.map((entry) => entry.department), ["โครงการ ข", "โครงการ ก", "โครงการ ค"]);
});

test("percentUsed and planStatus classify budget usage consistently", () => {
  assert.equal(percentUsed({ plan: 1000, actual: 500 }), 50);
  assert.equal(percentUsed({ plan: 0, actual: 0 }), 0);
  assert.equal(percentUsed({ plan: 0, actual: 1 }), Infinity);
  assert.equal(planStatus(50), "good");
  assert.equal(planStatus(80), "warn");
  assert.equal(planStatus(99.9), "warn");
  assert.equal(planStatus(100), "crit");
  assert.equal(planStatus(Infinity), "crit");
});

test("rental plan API and rentals page are wired with auth, schema init and the summary panel", async () => {
  const [api, schema, database, page] = await Promise.all([
    readFile(new URL("../app/api/rental-plans/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/rentals/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(api, /requireUser\(request\)/);
  assert.match(api, /requireUser\(request, "ADMIN"\)/);
  assert.match(api, /ensureRentalPlanSchema/);
  assert.match(schema, /rentalPlans = sqliteTable\("rental_plans"/);
  assert.match(database, /export async function ensureRentalPlanSchema/);
  assert.match(page, /summarizeRentalPlans/);
  assert.match(page, /สรุปเทียบแผนงบประมาณ/);
  assert.match(page, /user\?\.role === "ADMIN"/);
  assert.match(page, /fetch\("\/api\/rental-plans"\)/);
});
