# Uzspēlējam?

Mobile-first matchmaking web app for games and sports where another participant, partner, opponent or team is required.

## MVP status

Implemented:

- Supabase email/password auth, email confirmation and password recovery
- automatic profile creation and 16+ enforcement
- Teen Safety: under-18 profiles are forced private at database level
- runtime LV/EN locale switching
- Latvia-first activity catalogue; solo-only activities are excluded
- activity skill preferences and preferred sport positions
- Explore search, quick filters and advanced filters
- Create Game for physical/online games
- public/private games and tokenized private invites
- Join request with organizer approval/decline
- activity-specific positions and organizer position requirements
- team sports with Team A / Team B assignment
- Fully booked → Waiting List → organizer promotion
- Follow / Unfollow with configurable notification triggers
- game edit/cancel with participant/follower change notifications and custom cancellation windows
- participant leave/remove with capacity reopening notifications and late-cancellation tracking
- game-context-only organizer messaging, application chat and accepted-player group chat
- My Games states: hosting, joined, pending, waiting, following, past
- in-app Notification Center with unread/read state and Realtime toast updates
- public/private user profiles, avatar upload and reputation
- post-game 1–5 ratings + Reliable/Friendly/Good teammate/Fair player tags
- Report / Block safety flows
- total and per-player cost display with organizer cost split
- Share CTA for public games
- central `GameAccessContext` resolver and domain tests
- Row Level Security, isolated chat RLS and explicit transactional RPC commands for critical state changes
- production deployment on Vercel

## Stack

- Next.js 16 + TypeScript
- Supabase Auth + PostgreSQL
- Vercel

## Local verification

Copy `.env.example` to `.env.local` and fill the Supabase URL and publishable key.

```bash
npm ci
npm run test:domain
npm run typecheck
npm run build
npm run dev
```

## Database

Schema history is under `supabase/migrations/`.

Capacity-sensitive operations lock the game row. Critical writes (accept, promote, leave, participant removal, edit/cancel, follow preferences, ratings) use explicit RPC commands rather than generic client-side CRUD.

## Production configuration

For production email confirmation/password recovery, Supabase Auth must allow the production callback URL and production-grade SMTP should be configured. In-app notifications are implemented. Native/browser push delivery is intentionally separate from the core web MVP and requires push-provider credentials.

## Brand

Public product name: **Uzspēlējam?**

Technical repository/project slug: `uzspelejam_app` / `uzspelejam-app`.
