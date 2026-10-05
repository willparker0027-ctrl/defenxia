# DEFENXIA Aurora IoT

Rural banking security app — Aurora visual theme with the IoT-hardware feature set.
Built with React + Vite + TypeScript + Tailwind CSS. Wrapped with Capacitor for Android.

## Live preview

Every push to `main` auto-deploys on Vercel — open the Vercel project URL to
review the latest design without installing an APK.

## Local development

```bash
npm install
npm run dev
```

## Production web build

```bash
npm run build   # outputs to dist/
```

## Android APK

The native Android shell (`android/`, Capacitor plugins, Kotlin code) is kept
in the release source archives. Standard Capacitor flow for APK builds:

```bash
npm run build
npx cap sync android
# then build with Gradle: assembleDebug
```

## Project layout

- `src/` — app source (pages, components, services, styles)
- `public/` — static assets (icons, splash images)
- `index.html` — web entry
- `vercel.json` — Vercel build + SPA rewrite config
- `capacitor.config.ts` — Capacitor native-shell config
