# Uzspēlējam?

Mobile-first matchmaking app for games and sports where another participant, partner, opponent or team is required.

## Current MVP slice

- Supabase email/password Auth
- automatic profile creation
- 16+ signup validation
- Latvia-first activity and position catalogue
- Explore backed by Supabase
- Create Game through transactional RPC
- Join request with organizer approval
- organizer Accept / Decline
- Fully booked → Waiting List
- waiting-list promotion when a place opens
- Follow / Unfollow
- Leave game / withdraw request / leave waiting list
- My Games states
- central `GameAccessContext` resolver (`user_game_state + available_actions`)
- Row Level Security on exposed tables

## Stack

- Next.js 16 + TypeScript
- Supabase Auth + PostgreSQL
- Vercel

## Local setup

Copy `.env.example` to `.env.local` and fill the Supabase URL and publishable key.

```bash
npm ci
npm run test:domain
npm run typecheck
npm run dev
```

## Database

Schema source is under `supabase/migrations/`.

Critical state changes are exposed as explicit RPC commands instead of generic client-side CRUD. Capacity-sensitive operations lock the game row before accepting or promoting a player.

## Brand

Public product name: **Uzspēlējam?**

Technical repository/project slug: `uzspelejam_app` / `uzspelejam-app`.
