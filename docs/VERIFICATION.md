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

Initial production signup and password-reset form requests succeeded, but the first confirmed signup redirected to localhost because the provider URLs were not configured. That provider configuration was subsequently corrected. On 2026-10-06 Resend verified `uzspelejam.lv`, and custom SMTP was saved in Supabase. The recipient completed password recovery, reached the profile page, then explicitly confirmed successful sign-out and fresh sign-in using the new password. This check was repeated on `uzspelejam.lv`; the recipient confirmed that password change and fresh sign-in both succeeded. Auth recorded the subsequent sign-in at 14:02:16 UTC. Real mailbox delivery and password recovery are verified on both production hosts. Fresh custom-domain signup through Resend remains a distinct flow to check when creating the permanent account.

## Repeating checks

Run `npm run test:domain`, `npm run test:auth`, `npm run typecheck`, and `npm run build` locally or in CI. Run `npm run test:production -- https://YOUR_HOST` after deployment. Use `supabase/tests/production_smoke.sql` with an administrative SQL connection for rollback-only database checks.

Persistent production fixtures require explicit authorization, isolated test accounts, and cleanup of their games, storage objects and Auth sessions/users after verification. Never delete existing real accounts to perform these checks.

After the authorized game-flow checks, all three synthetic game-test accounts were signed out and deleted together with their three games. Database checks confirmed zero remaining fixture accounts, games and sessions. After the recipient completed custom-domain recovery and fresh sign-in, the separate mailbox-verification account was also removed under the original temporary-test authorization. Before removal, checks confirmed it had no created games, applications, participations, messages, or storage objects. Its refresh tokens and sessions were removed before deleting the Auth user; follow-up checks confirmed zero remaining Auth users, sessions and profile rows for that exact fixture ID. The local temporary credential/cookie file was also removed. The recipient can now register a permanent account with the same mailbox.

## Provider configuration follow-up

Supabase's final security advisor reported `auth_leaked_password_protection`: leaked-password checking is disabled. This is an Auth configuration follow-up, not a table RLS failure. The application enforces eight-character passwords on signup/reset; provider-level leaked-password checking requires the appropriate Supabase plan and Auth setting. See [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No paid plan was enabled as part of verification.

## Auth URL configuration correction

On 2026-10-06 the production Supabase dashboard still showed `http://localhost:3000` as Site URL and an empty redirect allow list. The authorized browser session changed Site URL to `https://uzspelejam-app-prod.vercel.app`, added exact profile/recovery callback URLs and the same callback path with `?next=**` for safe application return paths. The application already sanitizes `next` through `safeNext`; other origins and other callback paths are not allowed.

Live Auth requests with intentionally invalid signup/recovery tokens returned HTTP 303 to the production `/auth/callback`, preserving `/profile` and `/update-password`. An arbitrary game return path and a foreign-origin rejection were checked separately. These probes verify redirect configuration, not successful fresh-token session establishment. Existing emails embed their original redirect and should be replaced by a fresh request from the browser that will open the email link, as the default PKCE flow depends on that browser's verifier cookie.

At the initial checkpoint the default Supabase email service was in use. This has since been replaced by Resend SMTP, and the recipient completed real password recovery. No paid subscription was enabled.

The recipient's subsequent password-recovery request was blocked with `email rate limit exceeded`. The default provider permits two emails per hour per project; custom SMTP is required for dependable public production signup/recovery. Signup and password-recovery screens now explain this condition in LV/EN and explicitly state that no new link was sent. Rendering checks use an error query parameter and do not send additional emails. See [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits) and [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Custom production domain

`https://uzspelejam.lv` serves the application over HTTPS (HTTP 200). NIC's public A and DKIM records match the configured values. Vercel `NEXT_PUBLIC_SITE_URL` and Supabase Site URL are set to the custom domain. Three custom-domain callback URLs (profile, password reset, and safe dynamic `next`) have been added, retaining the original Vercel-host callbacks for transition compatibility.

Live Auth probes with deliberately invalid tokens redirect to the custom-domain profile/recovery/game callbacks; a foreign origin is rejected in favor of the configured custom-domain Site URL. These probes test redirect configuration without sending emails or consuming real verification tokens. Security advisors still report only the previously documented leaked-password-protection warning.
