# ZenStop Privacy Policy

Last updated: 2025-12-13

ZenStop is a Chrome extension designed to help you pause before visiting distracting websites. This Privacy Policy explains what information ZenStop stores, why it stores it, and the choices you have.

## Summary

- ZenStop stores settings and usage logs in Chrome Extension Storage (`chrome.storage.sync` and `chrome.storage.local`).
- ZenStop does not send your data to any external server. There are no analytics SDKs or tracking pixels.
- If you type personal information into the “reason/intention” textbox, ZenStop will store exactly what you type.

## What data ZenStop stores

ZenStop stores the following categories of data to provide its features:

### 1) User configuration (Settings)

Stored to remember how you want ZenStop to behave:

- Blocked websites list (domains/entries you provide)
- Adult-site blocking toggle and custom adult-site list
- Wait time (seconds)
- Allowed browsing duration (minutes) for the grace period after you continue
- Redirect URL (where ZenStop sends you when you bail)
- Daily visit goals (default goal and per-site overrides)
- Theme preference (Auto/Light/Dark)
- Custom intention tags (up to 5)

### 2) Usage stats (Progress)

Stored to show you how often you encounter the pause screen and how often you choose to continue or bail:

- Daily counts for:
  - Pauses/visits to blocked sites (how many times the pause screen appears for each blocked site)
  - “Continue” actions (how many times you proceed past the pause screen)
  - “Not worth my time” actions (mindful exits / bails)
- Aggregated history totals used to render the history chart in settings

### 3) Intentions log (User-entered notes)

If you choose to continue or bail and you have entered a reason and selected a category tag, ZenStop stores an “intentions” entry containing:

- Blocked site (domain key and display label)
- Your typed reason (free-form text)
- The selected category/tag
- Outcome (“continued” or “bailed/redirect”)
- Timestamp (when the entry was saved)
- The page URL at the time of the pause (used to help you recall context)

Important: the reason text is entirely user-provided. It may contain personal information if you choose to type it. ZenStop does not attempt to extract or infer personal information from it.

### 4) Grace-period timer state

ZenStop stores a per-site “grace period” expiry time so it can re-show the pause overlay after your allowed browsing duration ends.

## Where the data is stored

ZenStop uses Chrome’s Extension Storage APIs:

- `chrome.storage.sync`: Stores settings, stats, and the intentions log. If Chrome Sync is enabled in your browser, this data may sync to your Google account and be available on your other Chrome instances where ZenStop is installed.
- `chrome.storage.local`: Stores grace-period timer data (per-site expiry timestamps) on the current device.

ZenStop does not operate any external backend and does not transmit your data to third parties.

## What ZenStop does not collect

ZenStop does not intentionally collect or store:

- Passwords, authentication credentials, PINs, or security questions
- Payment information (credit card numbers, bank info, transaction data)
- Health information
- Location data (GPS, precise location)
- Personal communications (emails, messages, chats)
- Website content (page text, images, videos, form contents) beyond the URL/domain needed to apply blocking rules

## Why ZenStop requests certain permissions

ZenStop requests permissions that are necessary to provide its functionality:

- `storage`: Required to save your settings, stats, and intentions log.
- `alarms`: Used to reliably trigger a re-check when the grace period expires (so the overlay can reappear even if tab timers are throttled).
- Host access (site access): ZenStop must run on the websites you choose to block so it can detect the current domain and display the pause overlay on matching sites. ZenStop does not read page content for collection purposes; it uses host access to show the overlay and to identify the domain/URL for blocking and logging.

## How long data is retained

- Intentions log entries are capped to a recent limit (for example, the most recent 50 entries).
- Settings and aggregated stats are retained until you change them, clear them, or uninstall the extension.

## Your choices and controls

You can control and delete stored data:

- Change settings at any time in ZenStop’s Options page.
- Clear the intentions log from the Intentions tab (Clear all).
- Uninstalling ZenStop removes its stored extension data from the browser.
  - If Chrome Sync is enabled, Chrome manages synced extension storage; removing the extension removes ZenStop’s synced storage for this extension from your Chrome profile.

## Sharing and selling data

ZenStop does not sell your data. ZenStop does not share your data with third parties. ZenStop does not use your data for advertising.

## Security

ZenStop stores data only in Chrome’s extension storage. No method of storage is 100% secure, but ZenStop does not transmit data over the network and does not include third-party analytics libraries.

## Children’s privacy

ZenStop is not directed to children under 13 and does not knowingly collect personal information from children.

## Changes to this policy

If ZenStop’s data practices change, this policy will be updated and the “Last updated” date will be revised.

## Contact

If you have questions about this Privacy Policy, contact:

- Email: (add your support email here)

