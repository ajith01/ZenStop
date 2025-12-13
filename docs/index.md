---
title: ZenStop Privacy Policy
---

# ZenStop Privacy Policy

Last updated: 2025-12-13

ZenStop is a Chrome extension designed to help you pause before visiting distracting websites. This Privacy Policy explains what information ZenStop stores, why it stores it, where it is stored, and the choices you have.

## Scope

This policy applies to the ZenStop Chrome extension and its Options page, Popup, and on-page blocking overlay.

## Summary

- ZenStop stores settings and usage logs in Chrome Extension Storage (`chrome.storage.sync` and `chrome.storage.local`).
- ZenStop does not operate a backend server and does not send your data to any external service.
- If you type personal information into the "reason/intention" textbox, ZenStop will store exactly what you type.

## Data ZenStop stores

ZenStop stores the following data to provide its features.

### 1) User configuration (settings)

Stored so ZenStop can behave the way you configure it:

- Blocked websites list (domains/entries you provide)
- Adult-site blocking toggle and custom adult-site list
- Wait time (seconds)
- Allowed browsing duration (minutes) for the grace period after you continue
- Redirect URL (where ZenStop sends you when you bail)
- Daily visit goals (default goal and per-site overrides)
- Theme preference (Auto/Light/Dark)
- Custom intention tags (up to 5)

### 2) Usage stats (counts and history)

Stored to show you how often the pause screen appears and what you chose to do:

- Per-day counts for:
  - Pauses/visits to blocked sites (how many times the pause overlay appears)
  - "Continue" actions (how many times you proceed past the pause overlay)
  - "Not worth my time" actions (how many times you bail/redirect)
- Aggregated history totals used to render charts in settings

### 3) Intentions log (user-entered notes)

If you provide a reason and choose a category/tag, ZenStop stores an intentions entry containing:

- Blocked site (domain key and display label)
- Your typed reason (free-form text)
- Selected category/tag
- Outcome ("continue" or "redirect")
- Timestamp (when the entry was saved)
- Page URL at the time of the pause (used to help you recall context)

Important: the reason text is entirely user-provided. It may contain personal information if you choose to type it. ZenStop does not attempt to infer, extract, or categorize personal data beyond the tag you explicitly select.

### 4) Grace-period timer state

After you press "Continue", ZenStop grants a per-site grace period for the configured duration. ZenStop stores a per-site expiry timestamp so it can re-check and re-show the pause overlay after the grace period ends.

## Where your data is stored

ZenStop uses Chrome's Extension Storage APIs:

- `chrome.storage.sync`: Stores settings, stats, and the intentions log. If Chrome Sync is enabled in your browser, this data may sync to your Google account and be available on your other Chrome instances where ZenStop is installed.
- `chrome.storage.local`: Stores grace-period timer data (per-site expiry timestamps) on the current device.

ZenStop does not send your stored data to the extension developer or any third party.

## Data ZenStop does not collect

ZenStop does not intentionally collect or store:

- Passwords, authentication credentials, PINs, or security questions
- Payment information (credit card numbers, bank info, transaction data)
- Health information
- Location data (GPS, precise location)
- Personal communications (emails, messages, chats)
- Website content (page text, images, videos, form inputs) beyond the URL/domain needed to apply blocking rules and show your own logs

## Why ZenStop requests permissions / site access

ZenStop requests access that is necessary for its core function:

- `storage`: Required to save your settings, stats, and intentions log.
- `alarms`: Used to reliably re-check when the grace period expires (so the overlay can reappear even if tab timers are throttled).
- Site access (host permissions): ZenStop must run on the websites you choose to block so it can compare the current domain against your blocklist and display the pause overlay on matching sites. ZenStop does not read page content for collection purposes; it uses site access to show the overlay and to record the domain/URL for your own history and intentions log.

## How data is used

ZenStop uses stored data only to:

- Enforce your blocking rules on sites you configured
- Display the pause overlay and your "Opens / Goal" progress
- Show your history, goals, and intentions log in the settings UI
- Maintain a grace period timer after you continue

ZenStop does not use your data for advertising, profiling, or selling.

## Data retention

- Intentions log entries are capped to a recent limit (for example, the most recent 50 entries).
- Settings and aggregated stats are retained until you change them, clear them, or uninstall the extension.

## Your choices and controls

You can control and delete stored data:

- Change settings at any time in ZenStop's Options page.
- Clear the intentions log from the Options page (Intentions tab: "Clear all").
- Uninstalling ZenStop removes its stored extension data from your browser.
  - If Chrome Sync is enabled, Chrome manages synced extension storage; removing the extension removes ZenStop's synced storage from your Chrome profile.

## Sharing and selling data

ZenStop does not sell your data. ZenStop does not share your data with third parties. ZenStop does not run third-party analytics.

## Security

ZenStop stores data only in Chrome's extension storage. No method of storage is 100% secure, but ZenStop does not transmit data over the network and does not embed third-party data collection libraries.

## Children's privacy

ZenStop is not directed to children under 13 and does not knowingly collect personal information from children.

## Changes to this policy

If ZenStop's data practices change, this policy will be updated and the "Last updated" date will be revised.

## Contact

If you have questions about this Privacy Policy, contact:

- Email: a0afqo7he@mozmail.com
