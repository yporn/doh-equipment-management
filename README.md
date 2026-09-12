# DOH Equipment Management System

ระบบจัดการเครื่องจักรกรมทางหลวง พัฒนาด้วย Next.js-compatible Vinext, React,
TypeScript และ Cloudflare D1 โดยใช้ข้อมูลทะเบียนเครื่องจักรศูนย์สร้างทางขอนแก่น

## Development

```bash
npm install
npm run dev
```

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
