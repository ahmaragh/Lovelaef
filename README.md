# ورقة حُب — Web app (v1)

Single-page web app. Opens in Safari, added to the Home Screen like an app. All data lives in the browser storage on her phone.
Files: `index.html`, `app.js`, `sw.js`, `manifest.json`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`.

## 1. Host it on GitHub Pages (free, ~5 min, phone or laptop)
GitHub Pages needs a **public** repo on a free account. The code has no secrets — data never touches the repo.
1. github.com → New repository → name `waraqat-hob` → **Public** → Create.
2. Add file → **Upload files** → drop all 7 files → Commit.
3. Repo → Settings → Pages → Source: "Deploy from a branch" → Branch `main`, folder `/ (root)` → Save.
4. Wait ~1 minute. Your app URL: `https://<your-username>.github.io/waraqat-hob/`

To ship an update later: upload the changed files again (same names), commit. Her phone picks it up on next open.

## 2. Install on her iPhone
Open the URL in **Safari** (not Chrome) → Share button → **Add to Home Screen** → Add. Launch from the icon.
Do this once; from then on she uses the icon, never the browser tab. (Data of the home-screen app is separate from Safari's tab.)

## 3. OneDrive auto-backup (one-time, your Microsoft account, free)
1. Go to https://entra.microsoft.com → Applications → **App registrations** → **New registration**.
2. Name: `Waraqat Hob`. Supported account types: **Personal Microsoft accounts only** (or "Accounts in any organizational directory and personal Microsoft accounts" if you might use a work account).
3. Redirect URI: platform **Single-page application (SPA)**, value = your app URL exactly, e.g. `https://<username>.github.io/waraqat-hob/` (it's also shown at the bottom of the app's Backup screen). Register.
4. Copy the **Application (client) ID**.
5. In the app: الإعدادات → النسخ الاحتياطي → paste the client ID → **ربط OneDrive** → sign in with the Microsoft account whose OneDrive is on your laptop → Accept.
Backups land in OneDrive → **Apps → Waraqat Hob** as `waraqat-hob-latest.json` plus one dated file per day.

Notes: the Microsoft session may need a re-login every few months — the app shows a banner on the Today screen when that happens; orders keep saving locally regardless.

## Restore on a new phone
Install the app (step 2) → الإعدادات → النسخ الاحتياطي → **استرجاع من ملف** → pick a backup from Files (iCloud/OneDrive).

## What's in v2 (visual redesign)
Kiosk-style order wizard (photo tiles, round add-on tiles, big delivery/payment tiles, recent-customers one-tap fill, receipt review) · Today as action cards with the next step on each · order detail with tappable status stops · photos for menu items and delivery methods from the camera roll · icons throughout.

## What was in v1
Today dashboard · orders list with filters and search · new/edit order (items, sizes, add-ons, delivery method incl. "زوجي الغالي وصّلها", address & maps link, due time, customer delivery charge, discount, payment, notes, lead-time warning) · order detail with status flow, delivery-cost prompt on Delivered, payment recording, WhatsApp confirmation, edit/delete, change log · settings: menu & prices, add-ons, delivery methods, messages · your messages after each delivery and at milestones · manual export/import · OneDrive auto-backup · works offline.

Next: inventory & prep sheet (v2), finance & offers (v3), notifications (v4).
