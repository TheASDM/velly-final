# Patch Notes - Version 0.0.2

Date: June 2, 2026

## Studio Image Generator

- Fixed Valentro's image grounding so he should consistently appear with pale platinum-blonde hair instead of random black or dark hair.
- Improved how Studio builds image prompts:
  - Uses curated character and location descriptions more reliably.
  - Keeps key identity traits locked into the final image prompt.
  - Reduces prompt drift when Enzo rewrites a player's description.
- Studio-generated art now defaults to private.
- New art is visible only to:
  - the person who generated it
  - the DM
- Added gallery views:
  - My Studio: your private/shared generated art
  - Group Gallery: art intentionally shared with everyone
  - Favorites
  - DM All: DM-only view of all generated art
- Added Share to Group Gallery and Make Private controls.
- Pinning a Studio image to a wiki page now automatically makes that image shared, since wiki pages are visible to the group.
- Private gallery images are now protected at the image-file URL level, not just hidden from the gallery list.
- Removed the old DM Access password/passphrase system.
- DM delete buttons now appear automatically when logged in as DM through the real auth system.
- Fixed the mobile Studio title wrapping bug where "Studio" split into "STU" / "DIO".

## Gallery Management

- Existing old gallery art remains shared so nothing disappeared.
- New gallery entries include visibility metadata.
- Gallery API now returns permission info so the UI only shows actions the current user can actually use.
- Favorites now only show images the viewer is still allowed to access.
- DM delete now uses authenticated DM access instead of `.env` passphrase config.
- Removed stale `DM_PASSPHRASE` deployment config.

## Lore Submission System

- Rebuilt the Submit Lore page into a more polished submission workspace.
- Added large, cleaner type selection buttons for:
  - Item
  - Person
  - Place
  - Faction
  - Lore
  - Culture
- Added auto-saving local drafts.
- Added auto-growing text boxes so long submissions are easier to write and review.
- Added character counters.
- Added a readiness checklist.
- Improved login/identity display.
- Redesigned the My Submissions history with clearer status badges and cleaner rejected-submission feedback.
- Added easier Edit and Resubmit behavior for rejected drafts.
- Improved mobile layout for lore submissions.

## Wiki / Deployment

- Synced server-generated wiki lore content back into the repo before pushing.
- Preserved server-only/generated backup files without pulling unrelated generated-art clutter into git.
- Committed, pushed, rebuilt, and deployed the changes live on `vapp`.
- Verified the live site health check after deployment.
