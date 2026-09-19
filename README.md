# MaskFill

Fill any form with realistic fake data in one click. Free, unlimited, and fully private — it never sends anything anywhere.

## What it does

- **One click** — click the toolbar icon, use the right-click menu, or press `Ctrl+Shift+F` to fill a whole form
- **Fresh data every time** — no repeat emails, names, or numbers
- **Correct data** — values fit each field (phone prefixes, zip formats, regex `pattern`, `maxlength`, date pickers)
- **Handles hard fields** — React/Vue/Angular inputs, shadow DOM, dropdowns, radio groups, terms checkboxes, captcha skip
- **67 locales** — English, Hindi + English mix, Spanish, French, German, Japanese, Arabic, and 50+ more

## Shortcuts

| Action | Keys |
| --- | --- |
| Fill the page | `Ctrl+Shift+F` / `Command+Shift+F` |
| Fill one field | Right-click the field → **Fill this field** |
| Undo last fill | `Alt+Shift+U` / `Command+Shift+U` |

## Install

1. Download the latest release ZIP
2. Open `chrome://extensions` (or `edge://extensions`)
3. Turn on **Developer mode**
4. Click **Load unpacked** → select the unzipped folder

## Privacy

- No network requests, no tracking, no analytics, no remote code
- Everything runs locally in `chrome.storage.local` — settings are never synced
- No accounts, no API keys, no paywalls, no limits — free forever

## Test

```bash
npm test
```

Runs offline in Node — no browser needed.

## License

MIT