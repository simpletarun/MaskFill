# MaskFill — Free, Privacy-Focused Fake Data Form Filler for Chrome

**MaskFill** is a 100% free and unlimited Chrome extension that fills any online form with realistic test data in one click. It works 100% locally in your browser — **zero network requests, zero tracking, zero analytics**. No sign-ups, no paywalls, no API keys, no remote code.

## Why use MaskFill?

- **One-click form filling** — click the toolbar icon, use the right-click menu, or press `Ctrl+Shift+F` to fill an entire form instantly
- **Privacy-first** — MaskFill never sends your data anywhere. All generated information stays inside your browser
- **Free forever** — no premium tiers, no usage limits, no trials
- **Realistic data** — names, emails, phones, addresses, dates, and more, generated in the correct format for each field

## Working Features

### Instant Form Filling
- Fill an entire form with one click from the toolbar or context menu
- Fill a single field with the right-click → **Fill this field** option
- **Undo** any fill with `Alt+Shift+U` (`Command+Shift+U` on Mac) or the context menu
- `Ctrl+Shift+F` (`Command+Shift+F` on Mac) fills the page instantly

### Smart Field Detection
MaskFill recognizes and correctly fills:

- **Personal info** — first name, last name, full name, age, date of birth, gender, nationality
- **Contact details** — email, phone, mobile numbers, addresses, city, state, country, ZIP/postal codes
- **Country-code-aware phone numbers** — keeps a `+91` / `+1` prefix and generates a valid mobile number
- **Date of birth** — generates adult birth dates and respects field placeholders like `DD/MM/YYYY`
- **Account data** — usernames, passwords (with matching confirmation fields), OTP-style codes, PINs
- **Payment test data** — credit card, CVV, IBAN, SWIFT, bank account (recognized as test fields)
- **Workplace data** — company, job title, department, industry, university, degree
- **Web technical data** — IP, IPv6, MAC address, domain, URL, port, CIDR, MIME type
- **Dates, times, numbers, percentages** — values always respect `min`, `max`, `step`, `minlength`, and `maxlength`
- **Regex `pattern` attributes** — generated values pass the site's own validation rules

### Handles Tricky Fields
- **Terms & conditions / remember me** checkboxes are checked automatically
- Radio groups (including hidden MCQ options) are answered with real option values
- Dropdown (select) boxes are filled with a valid existing option
- Sensible fields are **never** marked as filled when the value would be invalid
- Safe fields like CAPTCHAs, file uploads, hidden, disabled, and read-only inputs are skipped automatically
- Works on **contenteditable** areas and fields inside **shadow DOM**

### Full Control
- **Fill only empty fields** mode — leave already-typed data untouched
- **Fill passwords** toggle — choose whether password fields are filled
- **Custom password value** — use your own test password
- **Max length** — cap generated values to fit your forms
- **Consistent profile mode** — one realistic person profile across all fields and forms
- **Field-matching options** — detect by name, id, class, placeholder, label, aria-label, and aria-labelledby
- **Ignore rules** — skip fields by pattern (protects CAPTCHAs and honeypots)
- **Ignored hostnames** — never touch forms on specified domains

### 66 Languages & Locales
English (US, UK, India, Australia, and more), Hindi (Devanagari names included), Spanish, French, German, Japanese, Arabic, Chinese, and 50+ more from the Faker library.

## Installation

1. Download this repository (or the release ZIP)
2. Open `chrome://extensions` in Chrome (or `edge://extensions` for Edge)
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the project folder
5. Open any form and click MaskFill's toolbar icon — done

## Privacy Policy (the short version)

- **No network requests** — MaskFill never phones home
- **No analytics, no tracking, no cookies**
- **No third-party APIs or CDNs** — all data is generated locally
- **No remote code** — nothing is downloaded at runtime
- All settings are saved only in your browser's local extension storage. Nothing is synced to any server, and nothing is shared

## Free & Unlimited

MaskFill is **free, open source, and unlimited**. There is no premium version, no trial, no feature limits, and no paid quota. It will stay that way.

## License

MIT