# MetroCare — Every Complaint Heard

MetroCare is an offline-first multilingual complaint operations dashboard created for **PS-07: Every Complaint Heard** at Metro Hacks by DevFest Gandhinagar. It gives Ahmedabad Metro staff a reliable way to log, classify, assign, resolve and analyse passenger complaints without requiring a network connection.

## Features

- Installable responsive PWA with a cached application shell
- Persistent IndexedDB storage through `idb`
- Complaint submission that works completely offline, including optional local photo storage
- Transparent rule-based classification for English, Gujarati, Hindi and common Gujlish terms
- Critical-to-low urgency scoring, explanations, recommended actions and manual overrides
- A transparent smart priority queue ranked by urgency, safety review, assignment state and waiting time
- Search, category/station/priority/status filters, sorting, assignment and status management
- Persistent activity timelines for assignment, status, notes, classification, replies and resolution
- Possible-duplicate detection with non-destructive incident linking
- Resolution notes, archive and confirmed deletion
- Independently editable and approvable English, ગુજરાતી and हिन्दी reply drafts
- Locally calculated dashboard and Recharts analytics
- Pending-sync queue with stable IDs and safe, idempotent simulated sync
- Per-record sync attempts, retry actions, last-sync metadata and local save-time indicators
- Explicit demo-data labels and safety warnings

## Prerequisites

- Node.js 22 or later
- pnpm 10 or later

## Install and run

```bash
pnpm install
pnpm dev
```

The Figma Make environment starts the development server automatically; do not start a second server there.

## Production build

```bash
pnpm build
pnpm preview
```

## Install the PWA

1. Open the app in Chrome or Edge over `https://` or `localhost`.
2. Wait for the first successful load so the service worker can cache the shell.
3. Use the browser's **Install app** action in the address bar or browser menu.

Some platforms prefer PNG install icons; those can be generated from the self-contained SVG in `public/icons/` for production distribution.

## Test offline functionality

1. Load the app once while online.
2. Open browser DevTools → Application and confirm `metrocare-db` under IndexedDB.
3. In DevTools → Network, select **Offline**, then refresh.
4. Confirm the orange offline banner appears and existing complaints remain visible.
5. Log a complaint and confirm its generated ID appears in **All Complaints**.
6. Refresh while still offline; verify the complaint and pending-sync count remain.
7. Edit its assignment, status, urgency and reply, then refresh and verify the changes.
8. Return online and use **Sync Centre → Retry sync**. Confirm the interface explicitly says **Simulated synced**.

## Architecture

### IndexedDB

`src/lib/database.ts` creates three stores:

- `complaints` holds complaint records, attachments, classification, replies and sync state.
- `settings` holds local configuration and the one-time demo-data seed marker.
- `syncMetadata` holds idempotent sync-attempt metadata.

React state is refreshed from IndexedDB after every mutation, making the local database the source of truth. Unsynced records are never discarded.

### Service worker

`public/sw.js` pre-caches the application entry, manifest and icon. Same-origin assets encountered during the first successful load, including Vite's hashed JavaScript and CSS, are cached for later offline use. Navigation falls back to the cached HTML shell.

### Classification

`src/lib/classifier.ts` is a transparent local keyword-rule boundary. It is **not machine learning** and does not use an external AI service. Rules detect multilingual category and urgency terms, expose a match score, and flag uncertain or safety-related results for human review. A genuine bundled local model could replace this module later without changing storage or UI workflows.

## What is real

- IndexedDB persistence and refresh survival
- Offline complaint creation and editing
- Service-worker caching after the initial successful load
- Local multilingual rules and draft templates
- Dashboard and analytics derived from stored records
- Pending queue persistence and stable complaint IDs

## What is simulated

There is no configured authority backend. **Retry sync** only transitions local pending records into a clearly labelled `simulated synced` state and writes local sync metadata. It does not transmit complaints or claim communication with Ahmedabad Metro.

## Known limitations

- The rule classifier is intentionally lightweight and must remain subject to staff review.
- Browser storage can be cleared by the user or browser policy; production deployments should add encrypted export and a real authorised backend.
- Photos are capped at 1.5 MB to avoid exhausting browser storage.
- Service-worker behaviour requires a secure context (`https://` or `localhost`).
- The sample seed data is illustrative and is explicitly labelled in the interface.
- Automated browser integration tests are not included; follow the manual offline checklist above.
