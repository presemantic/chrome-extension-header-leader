# Header Leader - HTTP Header Editor

Header Leader is a dependency-free Chrome Manifest V3 extension for creating reusable profiles that set, append, remove, enable, and reorder outgoing HTTP request headers.

[Install Header Leader from the Chrome Web Store](https://chromewebstore.google.com/detail/lecapjfnplakmnjnimecngdbndcakjbl).

## Features

- Multiple independently enabled profiles.
- Per-header `Set`, `Append`, and `Remove` operations.
- Drag-and-drop header ordering.
- Global pause that restores the previous active-profile selection.
- Local-only configuration in `chrome.storage.local`.
- No account, analytics, advertising, tracking, or remote code.

## Load unpacked

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose this repository directory.

## Verify

```bash
node --check core.js
node --check manager.js
node --check service-worker.js
node --test tests/*.cjs
```

## Chrome Web Store

Canonical listing copy and review disclosures are maintained in [`STORE_LISTING.md`](STORE_LISTING.md). Final graphical assets are stored under [`assets/`](assets/).

## Privacy and license

See the [privacy policy](PRIVACY.md) and [MIT license](LICENSE). The project website is [www.presemantic.com](https://www.presemantic.com/).
