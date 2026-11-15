# Header Leader Privacy Policy

Effective date: August 20, 2026

Header Leader - HTTP Header Editor is developed by Presemantic. The extension's single purpose is to let users create local profiles that set, append, or remove outgoing HTTP request headers in Chrome.

## Data handled by the extension

Header Leader handles only the configuration that the user enters into its interface: profile names, header names, header values, header operations, ordering, and enabled states. This user-generated configuration is stored locally on the user's device using `chrome.storage.local`.

The extension does not read or collect browsing history, visited URLs, page content, request bodies, response bodies, cookies, credentials, personal communications, analytics, advertising identifiers, or diagnostic telemetry. It does not create an account and does not use remote code.

## How configuration is used

Chrome's `declarativeNetRequest` API uses the locally stored configuration to modify outgoing HTTP and HTTPS request headers according to the profiles explicitly enabled by the user. Header values are transmitted by Chrome to the destination websites to which the user applies them. This transmission is the extension's user-facing purpose. Presemantic does not receive those values.

Users should place secrets or credentials in header values only when they intentionally want Chrome to send those values to the destination websites they visit.

## Data sharing and sale

Presemantic does not collect, receive, sell, rent, share, or transfer extension configuration or browsing data. The extension has no analytics, advertising, tracking, or third-party data integrations.

## Retention and deletion

Configuration remains in the local Chrome profile until the user deletes profiles or headers, clears the extension's local storage, or uninstalls the extension. Presemantic does not retain a server-side copy.

## Permissions

- `storage` stores profile and header configuration locally.
- `declarativeNetRequestWithHostAccess` applies the header changes without exposing request contents to extension code.
- Access to `http://*/*` and `https://*/*` is required because users may choose to apply configured header profiles to any HTTP or HTTPS destination.

## Limited Use

The use of information received from Chrome APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements. Data is used only to provide the extension's single user-facing purpose, is not used for advertising or unrelated purposes, is not transferred to third parties, and is not made available for human review.

## Changes

If the extension's data practices change, this policy and the Chrome Web Store disclosures will be updated before the changed behavior is released.

## Contact

Questions about this policy can be directed to [Presemantic](https://www.presemantic.com/).
