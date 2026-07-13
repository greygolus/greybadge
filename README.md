# GreyBadge

GreyBadge is a browser-based design studio for the common 44×11 monochrome LED name badge that identifies as USB HID `0416:5020` / `CH546`.

It runs entirely in a Chromium-based browser and uploads directly to the badge through WebHID—no replacement driver or desktop installer required.

**Live app:** [greybadge.vercel.app](https://greybadge.vercel.app)

## Use it locally

1. Install [Node.js](https://nodejs.org/) 20 or newer.
2. Plug in and switch on the LED badge.
3. Double-click `start.cmd` on Windows. (`start.ps1` is included as an alternative.)
4. Open `http://localhost:8765` in Microsoft Edge or Google Chrome.
5. Click **Connect badge**, select `CH546`, and approve the browser prompt.

The first start installs the small set of development dependencies. Keep the terminal window open while using the app and press `Ctrl+C` to stop it.

You can also start it manually:

```bash
npm install
npm run dev
```

## Features

- Eight hardware message slots and nine native badge effects
- Per-slot speed, blink, animated-border, duplicate, and reorder controls
- 25/50/75/100% hardware brightness
- Physically accurate full 44×11 preview with optional compact scroll lock
- Unicode text, image dithering, and an interactive pixel editor
- Quick create flow for text, pixel art, and frame animations
- Clock Studio with seven pixel fonts, ten premade borders, a full-display safe-pixel decoration editor, four time animations, improved single-digit centering, 12/24-hour formats, UTC support, snapshots, uncapped exact-minute sync, and a lower-wear five-minute mode
- Frame Studio with playback, horizontal or vertical frame strips, up to 12 frames, frame reordering, and adjustable previous-frame onion skinning
- Every existing slot and premade animation can be opened and remixed
- Searchable categorized library with 70+ animations, icons, and patterns
- Eight one-click multi-slot shows and an Effect Lab for procedural animation
- Auto-save plus JSON project import and export
- Direct WebHID upload with no replacement driver

## Clock Mode

The stock badge firmware stores a timestamp but does not render it as a clock. GreyBadge works around that honestly: live Clock Mode uploads a refreshed clock slot while the browser tab and badge remain connected. Exact mode updates when the displayed minute changes; lower-wear mode updates every five minutes. The animation frames run on the badge between updates.

Choose **Until disconnected** for an uncapped session, or set a 30-minute to 4-hour limit. GreyBadge requests a screen wake lock during live sessions and resynchronizes after the tab becomes active again. Some badge variants switch back to their charging screen while connected over USB; press the badge button to return to message playback. Clock snapshots are ordinary frozen playlist slots and do not require an ongoing connection.

## Hardware safety

Uploading replaces the current contents of the badge. Export anything you want to keep before pressing **Send to badge**. Automated tests and development commands never contact the physical badge.

## Privacy

Designs, imported images, USB access, and badge data remain in the browser. The hosted site uses Vercel Web Analytics for anonymous page-view and traffic measurements; badge contents and device information are not included.

## Development

```bash
npm install
npm test
npm run build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow, [DEPLOYMENT.md](DEPLOYMENT.md) for Vercel operations, and [AGENTS.md](AGENTS.md) for repository-specific implementation rules.

The packet layout was independently implemented from the public CH546/LS32 behavior documented by the GPL-2.0 project `jnweiger/led-name-badge-ls32`; none of that project's source code is bundled here.
