import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createCentralAllocationResolver, CENTRAL_RENTER_NAME } from "../lib/central-rental.mjs";
import { summarizeRentalPlans } from "../lib/rental-plan.mjs";

test("central allocation resolver redirects a central rental's monthly cost to each month's allocated project", () => {
  const rental = { renterName: CENTRAL_RENTER_NAME, startDate: "2025-10-01", expectedReturnDate: "2026-09-30", rateType: "YEARLY", duration: 1, totalAmount: 120000 };
  const allocations = [
    { fiscalYear: 2569, month: "10", project: "โครงการ ก" },
    { fiscalYear: 2569, month: "11", project: "โครงการ ข" },
  ];
  const resolver = createCentralAllocationResolver(allocations);
  const summary = summarizeRentalPlans([rental], [], 2569, resolver);
  const byDept = Object.fromEntries(summary.map((entry) => [entry.department, entry]));

  assert.equal(byDept["โครงการ ก"].monthly[0], 10000); // Oct redirected to โครงการ ก
  assert.equal(byDept["โครงการ ข"].monthly[1], 10000); // Nov redirected to โครงการ ข
  assert.equal(byDept[CENTRAL_RENTER_NAME].monthly[2], 10000); // Dec has no allocation yet — falls back
  assert.equal(byDept[CENTRAL_RENTER_NAME].monthly[0], 0); // Oct is NOT also counted against ส่วนกลาง

  const total = summary.reduce((sum, entry) => sum + entry.actual, 0);
  assert.equal(total, 120000); // nothing lost or double-counted across the redirected departments
});

test("a rental that isn't renterName central is completely unaffected by allocations", () => {
  const rental = { renterName: "โครงการ ค", startDate: "2026-01-01", expectedReturnDate: "2026-01-31", rateType: "MONTHLY", duration: 1, totalAmount: 5000 };
  const resolver = createCentralAllocationResolver([{ fiscalYear: 2569, month: "1", project: "ไม่ควรถูกใช้" }]);
  const summary = summarizeRentalPlans([rental], [], 2569, resolver);
  assert.equal(summary.length, 1);
  assert.equal(summary[0].department, "โครงการ ค");
});

test("allocations only apply within their own fiscal year", () => {
  const rental = { renterName: CENTRAL_RENTER_NAME, startDate: "2025-10-01", expectedReturnDate: "2027-09-30", rateType: "YEARLY", duration: 2, totalAmount: 240000 };
  const resolver = createCentralAllocationResolver([{ fiscalYear: 2570, month: "10", project: "โครงการ ปีถัดไป" }]);
  const summary2569 = summarizeRentalPlans([rental], [], 2569, resolver);
  // 2569's October has no matching allocation (that allocation belongs to fiscal year 2570) — falls back.
  assert.ok(summary2569.some((entry) => entry.department === CENTRAL_RENTER_NAME));
  assert.ok(!summary2569.some((entry) => entry.department === "โครงการ ปีถัดไป"));
});

test("central rental API and pages are wired with auth, schema init, and the simplified allocation flow", async () => {
  const [allocationApi, schema, database, rentalsApi, rentalsPage, dashboardPage] = await Promise.all([
    readFile(new URL("../app/api/central-rental-allocations/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/rentals/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/rentals/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(allocationApi, /requireUser\(request\)/);
  assert.match(allocationApi, /requireUser\(request, "ADMIN"\)/);
  assert.match(allocationApi, /ensureCentralAllocationSchema/);
  assert.match(schema, /centralRentalAllocations = sqliteTable\("central_rental_allocations"/);
  assert.doesNotMatch(schema, /rentalGroups|group_id/);
  assert.match(database, /export async function ensureCentralAllocationSchema/);
  assert.doesNotMatch(database, /ensureRentalGroupSchema/);
  assert.doesNotMatch(rentalsApi, /groupId/);
  assert.match(rentalsPage, /createCentralAllocationResolver/);
  assert.match(rentalsPage, /ค่าเช่าส่วนกลาง/);
  assert.match(rentalsPage, /ยังไม่ถึงเดือนนี้/);
  assert.match(dashboardPage, /createCentralAllocationResolver/);
});
