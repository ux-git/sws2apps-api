# Local-only report categories

Status: Prototype
Author: ux-git
Date: 2026-10-21

## Problem statement

Some congregations follow instructions not to keep confidential records, such
as field service reports, in cloud storage
([discussion 4788](https://github.com/sws2apps/organized-app/discussions/4788),
[discussion 5577](https://github.com/sws2apps/organized-app/discussions/5577)).
Today they can only turn congregation data sync off completely.

## Proposal

Admins can mark three congregation-level categories as local-only:

| Category | Who may switch it |
|---|---|
| `cong_field_service_reports` | on: secretary only, who holds the reference copy; off: any admin |
| `branch_field_service_reports` (S-1) | any admin |
| `branch_cong_analysis` (S-10) | any admin |

A local-only category is never stored or served by the API. Admin devices keep
their own copy; devices without an admin role drop theirs.

## Setting

`local_only_categories` holds one `{ value, updatedAt }` entry per category, so
entries merge independently through `mergeIncomingData`. The API sanitises it
(known categories, booleans, ISO timestamps clamped to the server clock) and
accepts it only from admins.

It is stored in `settings/local_only.txt`, not in `settings/main.txt`, and sent
to clients as a top-level `local_only_categories` field beside
`app_settings`. Older apps therefore never store it or send it back, and an API
rolled back to an earlier release never serves it. The app uploads the setting
only to an API that sent the field. An unreadable file keeps all categories
local-only (a file that exists but cannot be decrypted counts as unreadable);
the next real change replaces it with every untouched category still
local-only. If the server loses an entry, admin devices keep the category
local-only and do not re-apply it until an admin toggles it again.

S-4 reports submitted before the switch stay in the incoming queue until the
secretary fetches them, which removes them from the server as today; new
submissions and withdrawals are rejected.

Clients send only their own pending entries, never the whole map, so a stale
entry on one device cannot re-apply a setting.

## App modules

The app shows the setting as modules rather than categories. Each module can
be turned off, and each module that owns data picks where it goes:

| Method | Server | Between the congregation's devices |
|---|---|---|
| `server` | stores and serves it | through the server |
| `local` | never | nearby (native shell: Bluetooth, NFC, local network) or by sealed file |
| `device` | never | not at all |

`app_modules` holds `{ enabled, sync, updatedAt }` per module and is accepted
from admins only. The app derives the `local_only_categories` entries from it,
so the server enforcement stays the same: `local` and `device` both keep the
module's categories off the server. Modules: field service reports (secretary
only to leave the server; publisher records follow it), reports to the branch
office (S-1, S-10), meeting attendance.

A sealed file (`OLS1:` + ciphertext under the congregation access code) carries
a device's copy of the local categories to another device of the same
congregation; records merge newest-field-wins, nothing is deleted. The native
shell exchanges the same bundles over Bluetooth or the local network through
`window.organizedLocalSync` and `window.OrganizedNearby`.

## Sync flow

| Step | App (admin device) | API |
|---|---|---|
| Turn on | entry saved with `confirmed: false`; the category's version stays in the sync header | — |
| Next sync, download | server copy still merged, so nothing synced meanwhile is lost | serves the category as before |
| Next sync, upload | setting sent; the category is no longer uploaded | an outdated header is rejected, so the device merges first; on success stores the setting and empties the category file |
| Following syncs | entry confirmed; version left out of the header; category skipped on restore | stops serving the category; ignores local-only keys in conflict checks |
| Non-admin devices | clear the category on the sync that turns it on, unless it holds edits newer than its last download, which a prompt offers to export first; report pages hidden | — |
| Turn off | entry saved with `confirmed: false`; upload re-armed | stores the setting, then the re-uploaded records |
| Other admin devices | on the sync that sees it turned off, re-upload their copy | merges records per id |

S-4 submissions are rejected with `409 error_api_reports-local-only` while
congregation reports are local-only.

## Limitations

- Publishers' own per-user report records, and reports entered for delegated
  publishers, still sync to their own accounts.
- Any admin role (admin, coordinator, secretary) can make S-1 or S-10
  local-only, which deletes the server copy, as with other admin settings.
- Admin devices do not sync these categories with each other while local-only.
  A new admin device starts empty and needs a file backup imported. Records
  created on several admin devices in that time can be duplicated when the
  category syncs again.
- Every admin device must run the latest app before a category is turned on.
  Old app versions on other devices keep their copies.
- The storage bucket's soft delete or object versioning may keep purged files
  for its retention period.
- If a write fails between saving the setting and emptying the category, or
  data is uploaded while the API is rolled back, a copy can stay stored (never
  served) until the category is turned off and on again.
- Loading a congregation checks for one more file.
- If the server loses an entry (for example `local_only.txt` is deleted), the
  category syncs again for the API and for devices without an admin role,
  while admin devices that still have it on keep it local-only and download
  the server copy on every sync until an admin toggles it again.
- A report editor's edits kept on its device when a category turned on are not
  re-uploaded when it turns off, until that device edits again.
- Devices that cannot edit reports drop their copy silently, including the
  confirmed status publishers see for past months on their S-4 form.
- A device's unconfirmed change is stored in the settings, so it also appears
  in a file export of that device.
