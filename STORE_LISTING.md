# Chrome Web Store Listing

## Product identity

- Name: `Header Leader - HTTP Header Editor`
- Primary language: English
- Category: Developer Tools
- Website: `https://www.presemantic.com/`
- Support URL: `https://github.com/presemantic/chrome-extension-header-leader/issues`
- Privacy policy: `https://github.com/presemantic/chrome-extension-header-leader/blob/main/PRIVACY.md`
- License: MIT

## Summary

Create profiles to edit HTTP request headers in Chrome: set, append, remove, enable, and reorder custom headers.

## Detailed description

Header Leader is a local HTTP header editor for Chrome developers. Create reusable profiles to set, append, remove, enable, and reorder outgoing request headers for website, API, and staging-environment debugging.

Create any number of profiles, enable several profiles at once, and organize each profile's header stack. For every header you can:

- Set a value.
- Append a value, including safe comma-separated emulation for custom header names that Chrome cannot append natively.
- Remove the header.
- Enable or disable it independently.
- Reorder it with drag and drop.

Use profiles to test custom headers, feature flags, API integrations, authentication flows, and staging environments.

The extension applies profiles to top-level page loads and subresources, saves configuration locally, and reconciles Chrome's dynamic rules whenever settings change. A global switch can suspend all modifications and restore the previous active-profile selection later.

Privacy by design:

- No account.
- No analytics or advertising.
- No remote code.
- No browsing-history collection.
- No transfer of profile data to Presemantic or third parties.
- Profile configuration is stored only in `chrome.storage.local`.

Header Leader requires access to HTTP and HTTPS sites solely to apply the header changes the user configures.

## Single purpose

Let users create local profiles that set, append, or remove outgoing HTTP request headers in Chrome.

## Permission justifications

### storage

Stores user-created profile names, header names and values, operations, ordering, and enabled states locally in the Chrome profile. No configuration is synced to or stored by Presemantic.

### declarativeNetRequestWithHostAccess

Required to apply the user's configured request-header modifications through Chrome's privacy-preserving declarative rules. The extension does not read request or response contents.

### Host access: http://*/* and https://*/*

Required because the extension's single purpose is to apply user-configured header profiles to HTTP and HTTPS destinations selected through normal browsing. The extension does not collect URLs or browsing history.

## Remote code

No. The extension does not load or execute remote code. All executable code is included in the uploaded package.

## Data usage disclosure

- User-generated content: profile names, header names, and header values are entered by the user and stored only in `chrome.storage.local`.
- The extension does not collect browsing activity, website content, authentication information, personally identifiable information, financial information, location, communications, or analytics.
- The user's configured header values are sent by Chrome only to destination websites as explicitly required by the extension's visible feature.
- Data is not sold, transferred, used for advertising, used for creditworthiness or lending, or made available for human review.
- The extension complies with the Chrome Web Store User Data Policy and Limited Use requirements.

## Distribution

- Visibility: Public
- Pricing: Free
- Regions: All regions
- Mature content: No
- In-app purchases: No

## Graphic assets

- Store icon: `icons/icon-128.png` (128x128 PNG)
- Screenshots:
  - `assets/header-leader-screenshot-1280x800.png`
  - `assets/header-leader-profiles-1280x800.png`
  - `assets/header-leader-operations-1280x800.png`
  - `assets/header-leader-multiple-profiles-1280x800.png`
  - `assets/header-leader-pause-1280x800.png`
- Small promo tile: `assets/small.png` (440x280 PNG)
- Marquee promo tile: `assets/merquee.png` (1400x560 PNG)
