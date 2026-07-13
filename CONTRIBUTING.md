# Contributing

## Local setup

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Run `npm run dev` and open `http://localhost:8765` in Edge or Chrome.

## Before submitting a change

Run both checks:

```bash
npm test
npm run build
```

For interface changes, also verify the affected workflow in a real Chromium browser at desktop and narrow viewport widths.

## Project layout

- `index.html` — application structure and dialogs
- `styles.css` — responsive visual system and badge simulation
- `app.js` — editor state, rendering, WebHID connection, and UI behavior
- `protocol.js` — CH546 payload construction and HID report writing
- `library.js` — premade art, animations, shows, and procedural effects
- `tests/` — protocol and library regression tests

## Hardware testing

Uploading overwrites the badge. Do not make an upload part of an automated test. When a physical-device test is needed, export the existing project first and document the exact badge model used.

## Pull requests

Keep changes focused, explain user-visible behavior, and include the validation commands you ran. Protocol changes should include or update a regression test.
