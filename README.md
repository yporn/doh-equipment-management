# DOH Equipment Management System

ระบบจัดการเครื่องจักรกรมทางหลวง พัฒนาด้วย Next.js-compatible Vinext, React,
TypeScript และ Cloudflare D1 โดยใช้ข้อมูลทะเบียนเครื่องจักรศูนย์สร้างทางขอนแก่น

## Development

```bash
npm install
npm run dev
```

## Deployment

Deploy manually from a macOS/Linux machine with `wrangler` authenticated
against the Cloudflare account that owns the `doh-equipment-management-db`
D1 database:

```bash
npm run build
npx wrangler deploy --name doh-equipment-management
```

**Do not build on Linux (including GitHub Actions/Ubuntu runners) and
deploy that output.** A build produced on Linux comes out of `vinext build`
without errors, but the `/login` route silently 404s in production — this
reproduced consistently across multiple clean GitHub Actions runs and is a
platform-specific bug in `vinext` (currently a beta package), not something
in this app's code. Building on macOS has been reliable every time it was
tested. Until the upstream bug is understood/fixed, always build and deploy
from a macOS machine.

## Current scope

- Dashboard summary
- Machinery registry with search, filtering, sorting, pagination, create and edit
- Rental, return and rental-cost workflows
- Repair tracking without overwriting rental state
- Service records with fiscal-year document numbering and printable reports
- Multi-account authentication with administrator and staff roles
- Persistent Cloudflare D1 storage and migrations
- Responsive desktop and mobile layout
- Production data model in `docs/data-model.md`

When the database is unavailable, the machinery registry falls back to the
bundled source data in `data/machineries.json` for read-only continuity.
