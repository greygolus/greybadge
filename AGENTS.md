# Repository instructions

These rules apply to automated coding agents and contributors working in this repository.

## Architecture

- This is a client-only Vite application. Do not introduce a backend for badge design or USB access.
- Keep all CH546 packet construction in `protocol.js` and all premade content generation in `library.js`.
- Preserve the hardware dimensions: 44×11 visible pixels and 48 columns per stored animation frame.
- Keep the app usable without a connected badge; WebHID is only required when the user explicitly connects or uploads.

## Safety and privacy

- Never trigger a physical badge upload from automated tests or browser verification.
- Treat **Send to badge** as destructive because it replaces the badge’s current playlist.
- Do not transmit designs, imported images, USB identifiers, or badge data to analytics or external services.
- Vercel Web Analytics is limited to normal anonymous page-view measurement.

## Required checks

Run these after implementation changes:

```bash
npm test
npm run build
```

Use a Chromium browser for interface verification. WebHID support is expected in Edge and Chrome over `https://` or localhost.

## State compatibility

The project is saved in `localStorage` under versioned keys. When changing the saved state shape, add a backward-compatible migration in `loadState()` so existing projects continue to open.
