# MVP verification — 2026-10-06

The original product conversation was reviewed against the implementation. The current release scope is the free MVP: Latvia, LV/EN, 16+, profiles and Teen Safety, physical/online public and private games, organizer-approved applications, capacity, waiting list, Follow preferences, in-app notifications, game-context messaging, teams/positions, ratings, report/block and sharing.

Premium, recurring games, boosted listings, integrated payments, Like and advanced device push remain later-version features, as specified in the original MVP+/V2 scope.

## Completed checks

- GitHub CI: locked dependency install, domain tests, auth redirect/age tests, TypeScript and production build.
- Vercel production deployment and HTTP rendering/guest route guard checks.
- Database smoke test under actual `anon`/`authenticated` roles, with all changes rolled back: age/profile safety, private access, join/accept, capacity, waiting-list promotion, chat RLS, cancellation, ratings and notification read state.
- Authorized temporary production fixtures: fully booked game renders the accepted count and filled position correctly in LV and EN, without exposing participant identities to guests.
- Actual production form requests: sign-in for organizer and player, profile/My Games/messages/notifications routes, Create Game, Join and Accept, followed by the accepted-player state and group-chat link.
- Accepted participant sent a test group message through the production form; the organizer read it. The private-game direct URL returned 404 to guests; a generated invite opened a guest preview and a signed-in player claimed access.
- A third signed-in test account joined a full game's waiting list through the form. The accepted player left, capacity reopened in the public UI, and the organizer promoted the waiting user; the promoted user then saw the accepted state and group-chat link.
- Deployed private-invite and chat screens render their system text in LV and EN. A fresh sign-in restores the account's saved Latvian language without relying on a previously stored browser locale.

## Email verification boundary

Production signup and password-reset form requests succeeded. Supabase recorded confirmation and recovery sending timestamps. These results prove the application's handoff to Auth, not receipt in the external mailbox or successful consumption of the emailed links. Recipient-side confirmation and link completion remain required before claiming the entire email flow is verified.

## Repeating checks

Run `npm run test:domain`, `npm run test:auth`, `npm run typecheck`, and `npm run build` locally or in CI. Run `npm run test:production -- https://YOUR_HOST` after deployment. Use `supabase/tests/production_smoke.sql` with an administrative SQL connection for rollback-only database checks.

Persistent production fixtures require explicit authorization, isolated test accounts, and cleanup of their games, storage objects and Auth sessions/users after verification. Never delete existing real accounts to perform these checks.

After the authorized game-flow checks, all three synthetic game-test accounts were signed out and deleted together with their three games. Database checks confirmed zero remaining fixture accounts, games and sessions. The separate mailbox-verification account remains pending completion of the external email-link tests and will be deleted after that boundary is checked.

## Provider configuration follow-up

Supabase's final security advisor reported `auth_leaked_password_protection`: leaked-password checking is disabled. This is an Auth configuration follow-up, not a table RLS failure. The application enforces eight-character passwords on signup/reset; provider-level leaked-password checking requires the appropriate Supabase plan and Auth setting. See [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No paid plan was enabled as part of verification.
