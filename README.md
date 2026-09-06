# MaskFill — Free, Privacy-Focused Fake Data Form Filler

**MaskFill** is a 100% free and unlimited Chrome extension that fills any online form with realistic, never-repeating test data in one click. Everything runs locally in your browser — **zero network requests, zero tracking, zero analytics**. No sign-ups, no paywalls, no API keys, no remote code.

## Why MaskFill?

- **One-click filling** — click the toolbar icon, use the right-click menu, or press `Ctrl+Shift+F` to fill an entire form instantly
- **Never-repeating data** — every click generates a fresh, realistic profile; the same email or name never comes back twice
- **Privacy-first** — nothing ever leaves your browser. Settings and the undo snapshot live only in `chrome.storage.local` and are never synced to any server
- **Free forever** — no premium tiers, no usage limits, no trials
- **Valid data** — values respect each field's `min`/`max`/`step`/`maxlength` and pass the site's own `pattern` validation
- **67 locales** — English (US, UK, India, and more), Hindi (Devanagari names), an English + Hindi mix, Spanish, French, German, Japanese, Arabic, Chinese, and 50+ more

## Features

### Smart Field Detection
MaskFill recognizes and correctly fills:

- **Personal info** — first/last/full name, age, date of birth, gender, nationality
- **Contact details** — email, phone, mobile, address, city, state, country, ZIP/postal code
- **Country-aware phones** — keeps a `+91` / `+1` prefix and appends a valid local number
- **Date of birth** — generates adult birth dates and honors placeholders like `DD/MM/YYYY`, and fills Day/Month/Year dropdowns as a real calendar date
- **Account data** — usernames, passwords (with matching confirmation fields), OTP codes, PINs
- **Payment test data** — credit card, CVV, IBAN, SWIFT, bank account (recognized as test fields)
- **Workplace data** — company, job title, department, industry, university, degree
- **Web technical data** — IP, IPv6, MAC address, domain, URL, port, CIDR, MIME type
- **Dates, times, numbers, percentages** — values always respect field constraints
- **Regex `pattern` attributes** — generated values pass the site's own validation

### Handles Tricky Fields
- **Framework-controlled inputs** — native setter + event sync so React, Vue, Angular, and jQuery forms pick up filled values correctly
- **Terms / remember me** checkboxes are checked automatically
- **Radio groups** (including hidden MCQ options) are answered with a real option value
- **Dropdowns** are filled with a valid existing option
- **Shadow DOM** and **contenteditable** areas are supported
- CAPTCHAs, file uploads, and disabled/read-only/hidden-by-design fields are skipped automatically
- **Fill hidden fields** toggle — optionally fill inputs inside closed popups and modals

### Full Control
- **Fill only empty fields** — for automatic page-load filling, so your typed data is never touched (clicking the toolbar icon always regenerates and overwrites)
- **Fill passwords** toggle + custom test password value
- **Max length** — cap generated values to fit your forms
- **Consistent profile mode** — one realistic persona across all fields and forms
- **Field matching** — detect by name, id, class, placeholder, label, aria-label, and aria-labelledby
- **Ignore rules** — skip fields by pattern (protects CAPTCHAs and honeypots)
- **Per-site rules** — skip specific fields on specific sites, e.g. `blog.example.com | [name=verify]`; hostname covers subdomains
- **Ignored hostnames** — never touch forms on specified domains
- **Check all boxes** — one click checks every checkbox on the page (scopes, permissions, subscribe, terms)
- **Undo across refreshes** — the last fill is remembered, so `Undo` still works after you navigate away and come back

## Usage

| Action | How |
| --- | --- |
| Fill entire page | Click the toolbar icon, right-click → **Fill this form**, or `Ctrl+Shift+F` (`Command+Shift+F` on Mac) |
| Fill one field | Right-click a field → **Fill this field** |
| Undo last fill | Right-click → **Undo last fill**, or `Alt+Shift+U` (`Command+Shift+U` on Mac) |
| Settings | Right-click the toolbar icon → **MaskFill settings** |

## Installation

1. Download this repository (or the latest release ZIP)
2. Open `chrome://extensions` in Chrome, Brave, or Microsoft Edge (`edge://extensions`)
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the project folder
5. Open any form and click MaskFill's toolbar icon — done

## Privacy Policy (the short version)

- **No network requests** — MaskFill never phones home
- **No analytics, no tracking, no cookies**, no third-party APIs or CDNs
- **No remote code** — nothing is downloaded at runtime; the data library ships inside the extension
- **Fast by design** — the heavy data library is injected only on pages that actually contain a form, never on every page
- **Local storage only** — all settings and the undo snapshot are saved in `chrome.storage.local`; nothing is synced to any server or shared anywhere

## Development

```bash
npm install        # install dev dependencies (jsdom, esbuild)
npm test           # run the full test suite (menu, generator, options, DOM E2E)
npm run bundle:faker  # rebuild lib/faker.min.js from source (@faker-js/faker)
```

The extension ships with no build step — load the folder directly. Tests use a stubbed `chrome` API and jsdom, so they run offline in plain Node.

## Free & Unlimited

MaskFill is **free, open source, and unlimited**. There is no premium version, no trial, no feature limits, and no paid quota. It will stay that way.

## License

MIT