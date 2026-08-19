# Project Handover & Credentials Form

Complete one copy of this form for each project before handover.

## 1. Project Information

- **Project Name:** Bubbles Car Wash & Cafe — Online Booking System
- **Client Name:**
- **Project Reporting Manager:**
- **Repository URL:** https://github.com/techb2bnew/-bubblescarwash
- **Current Developer:**
- **New Developer:**
- **Project Status:** In active development — core booking system and admin panel are functional; a few database migrations are written but not yet applied to production

## 2. Project Overview

- **Purpose:** Lets customers book car wash / detailing services online (choosing vehicle type, service tier, add-ons, date & time), and gives the business an admin panel to manage services, availability, and bookings.
- **Major Modules:**
  - Customer booking flow (`/book`) — vehicle/service selection, add-ons comparison, date & time picker, booking confirmation
  - Admin Dashboard — stats, quick links, bookings-by-service and bookings-by-day charts
  - Bookings management — search/filter/sort, status (Confirmed/Completed/Rescheduled/Cancelled), reschedule with calendar picker, Add-Ons count per booking
  - Services, Add-Ons, Categories, Vehicle Types — full CRUD admin modules
  - Calendar — mark days closed, block individual/range time slots, create manual bookings, duration-aware availability
  - Customers — aggregated booking history per customer
  - Analytics — revenue chart, recent transactions, bookings breakdown
- **Current Status:** Feature-complete for MVP scope described above; pending final QA pass and deployment of outstanding database migrations to production
- **Completion %:** ~85–90% (core features built and locally verified; production migration rollout + broader QA still pending)

## 3. Technology Stack

- **Frontend:** Next.js (App Router, TypeScript, Tailwind CSS v4)
- **Backend:** Next.js Server Actions (no separate API server)
- **Database:** Supabase (PostgreSQL), with Row Level Security policies + Postgres RPC functions for booking logic
- **Hosting:** Vercel
- **Cloud:** Supabase (Postgres + Auth)
- **AI/ML:** None

## 4. URLs

- **Production:** https://bubblescarwash.vercel.app
- **Staging:**
- **Development:** http://localhost:3000
- **Admin:** https://bubblescarwash.vercel.app/admin
- **API:** N/A — no standalone API, all data access goes through Next.js Server Actions calling Supabase directly
- **Documentation:**

## 5. Repository

- **Main Branch:** main
- **Important Branches:**
- **Pending PRs:**
- **Unmerged Branches:**

## 6. Credentials & Access

- **Git Provider / Org / Git Email / SSH Key / PAT / Credential Vault:**
- **Server IP / SSH User / SSH Key Location / Control Panel:** N/A — hosted on Vercel (no self-managed server)
- **Domain Registrar / DNS Provider / Login Email / SSL Provider:**
- **Database Host / DB Name / Username / Vault:** Supabase project (see `.env.local` for `NEXT_PUBLIC_SUPABASE_URL`) —
- **SMTP Provider / Sender Email / SMTP Username / Reply-To:** N/A — no transactional email currently wired up
- **Cloud Accounts (AWS/Azure/GCP/DO/Cloudflare/Vercel/etc.):** Vercel —
- **Third-party (OpenAI, Stripe, Firebase, Supabase, Twilio, SES, Mailgun, SendGrid, Maps, etc.):** Supabase —
- **Admin Panel URLs & Login details:** https://bubblescarwash.vercel.app/admin — default seeded login `admin@carwash.com` (see `supabase/migrations/0002_seed_admin.sql`; change password after first login)
- **Password Manager Folder / Credential Location:**

## 7. Any Renewals & Billing

| Service | Renewal Date | Billing Email | Owner | Auto Renewal |
|---|---|---|---|---|
| Vercel | | | | |
| Supabase | | | | |
| Domain | | | | |

## 8. Environment & Deployment

- **Environment Variables:**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (see `.env.local.example` in repo root)
- **Deployment Steps:** Push to `main` → Vercel auto-builds and deploys. Database changes are NOT part of this pipeline — see note below.
- **Rollback Steps:** Revert the commit on `main` and let Vercel redeploy; no automated DB rollback exists, so a bad migration must be reverted manually in Supabase.
- **CI/CD:** None beyond Vercel's built-in auto-deploy-on-push; no test suite currently wired into a pipeline.
- **Any Cron Jobs / Queue Workers:** None.

**Important — pending Supabase migrations:** All schema changes live as numbered SQL files in `supabase/migrations/` and must be run manually in the Supabase SQL Editor (there is no `supabase db push` step in deployment). As of this handover, migrations **0012 through 0015** have been written but their production application status should be confirmed/completed:
- `0012_reschedule_status.sql` — adds "rescheduled" booking status
- `0013_blocked_slots.sql` — per-time-slot blocking (table + RPC updates)
- `0014_booked_times_reason.sql` — surfaces block reason to the public calendar
- `0015_duration_aware_availability.sql` — makes availability/overlap checks respect each service's `duration_minutes` instead of a fixed slot

## 9. Documentation & Assets

- **README:** `README.md` (default create-next-app boilerplate — not project-specific yet)
- **Architecture:**
- **API Docs:** N/A (see Technology Stack)
- **DB Schema:** `supabase/migrations/*.sql` — the migration files are the source of truth for schema
- **Postman:**
- **Figma:**
- **KT Videos (loom links):**
- **Client Docs:**

## 10. KT & Project Status

- **KT Given To:**
- **KT Date:**
- **Topics Covered:**
- **Pending Features:**
  - Deploy migrations 0012–0015 to production Supabase
  - Broader QA pass across booking flow + admin modules
- **Known Bugs:**
  - None currently tracked as open; the create_booking/get_booked_times DB functions were recently rewritten (0013–0015) and should be re-verified in production after migrations run
- **Recommendations:**
  - Run pending migrations in order (0012 → 0015) via Supabase SQL Editor before relying on reschedule, time-slot blocking, or duration-aware booking in production
  - Add an automated test suite (currently none) before further feature work
  - Replace the default seeded admin password (`supabase/migrations/0002_seed_admin.sql`) if not already done

## 11. Final Checklist

- [ ] Latest Code pushed
- [ ] Documentation updated
- [ ] KT completed
- [ ] Loom Videos URLs (workaround flow videos of the project and files)
- [ ] Credentials document link (or add all at the last of this doc)
