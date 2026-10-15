# Zotero Safe Edit

A Zotero 10 plugin through which **local applications** can propose edits to
existing Zotero items. Nothing is written until **you approve the changes in
Zotero**. Every change is checked, logged and can be undone.

It is meant for tools which find problems in a library (wrong DOIs, DOIs in
the wrong field, …) and want to offer one-click fixes without risking the data.

## Safeguards

| | Safeguard |
|---|---|
| Local only | Zotero's local server only accepts requests from this computer and drops requests from web pages. |
| Registered applications | Each application needs its own token (Settings → Safe Edit, or a registration request you confirm in Zotero). Tokens can be revoked. |
| Auto-sync off | Editing is refused while automatic sync is on, so changes stay local until you sync by hand. |
| Fresh backup | Editing is refused unless the group was backed up recently (default: 60 minutes). |
| Edits only | The plugin can only change fields of existing regular items. It cannot create, delete, trash or merge items, or change item types. |
| Allowed fields | Only fields you allow in the settings can be changed (default: `DOI`), and only if the item type has that field. |
| Expected old value | A change is only written if the field still has the value the application saw; checked when the dialog opens and again on approval. |
| Batch limit | At most 25 changes per approval (configurable). |
| Line batches | Off by default. If allowed in the settings, a larger batch (default: at most 10,000) is accepted when every change only adds one line at the end of a field, e.g. `OpenAlex: W…` in Extra, or removes such a line again (its undo). The plugin checks this for each change. Such a batch is shown as a compact list and approved with an "I have checked the list" tick box; progress is shown while writing. |
| Approval | All changes of a batch are shown before → after with the differences highlighted. *Approve* is only enabled after scrolling to the end of the list. Single changes can be unticked. |
| Log | Every change is logged before it is written, in an append-only log. |
| Undo | Applied changes can be undone (only if the field was not changed since), through the same checks and dialog. |

## Install

1. Download `zotero-safe-edit-<version>.xpi` from the releases.
2. Zotero → Tools → Plugins → gear icon → *Install Plugin From File…*
3. Settings → Safe Edit: check the limits and allowed fields, add an application
   and copy its token into the application.

Requires Zotero 10.0.x.

## For application developers

All requests: `POST http://localhost:23119/safe-edit/<endpoint>` with a JSON
body, header `Content-Type: application/json` and, except for `register`,
`X-Safe-Edit-Token: <token>`. Requests from web browsers are dropped by Zotero;
call the endpoints from your application, not from a web page.

| Endpoint | Body | Result |
|---|---|---|
| `register` | `{name}` | asks the user in Zotero; `{name, token}` or `{denied: true}` |
| `status` | `{group_ids: []}` | versions, auto-sync, limits, allowed fields, backup age per group |
| `backup` | `{group_id}` | creates a snapshot of the group |
| `preview` | `{changes: []}` | checks and differences per change, nothing is written |
| `apply` | `{changes: [], action?: "edit" \| "restore"}` | approval dialog, then writes; result per change |
| `log` | `{group_id}` | all log entries with the current state of each change |
| `undo` | `{group_id, entry_ids: []}` | reverses applied changes (approval dialog) |
| `restore` | `{group_id, snapshot?}` | changes which restore the allowed fields from a snapshot; apply them with `action: "restore"` |

A change: `{group_id, item_key, field, old, new, reason}` — `field` is a Zotero
field name (e.g. `DOI`, `extra`, `title`), `old` the current value as the
application saw it (empty string for an empty field), `reason` is shown to the
user.

The `apply` and `undo` requests only return after the user has closed the
approval dialog — use a long timeout.

## Files

In the Zotero data directory, folder `safe-edit/`:

- `log/<libraryID>.jsonl` — the change log (append-only)
- `backups/<libraryID>/<time>.json` — snapshots: all items of the group with
  their keys, plus a copy of the log; the newest 10 are kept

The backup also triggers Zotero's own database backup into
`zotero.sqlite.safe-edit.bak` (Zotero's normal rotating backups are not touched).

## Restoring

Item keys always stay the same, as items are only ever edited, never replaced.

1. **Undo** single changes or batches.
2. **Restore from a snapshot** (`restore` endpoint): proposes changes which bring
   the allowed fields back to the snapshot values; approved like any edit.
3. **Restore to Online Library** (Zotero: Settings → Sync → Reset): replaces the
   local group with the version on zotero.org, with the same keys. Works as long
   as the unwanted changes were not synced — which is why auto-sync must be off.
   Discards all unsynced local changes in that group.
4. **Zotero's database backup** (`zotero.sqlite.safe-edit.bak` or Zotero's own
   `zotero.sqlite.bak`): replaces the whole local database. Last resort; see the
   Zotero documentation on restoring from a backup.

## Development

```sh
./build.sh               # builds build/zotero-safe-edit-<version>.xpi
node tests/diff.test.js  # tests of the difference highlighting
node tests/lines.test.js # which changes count as adding a line
```

**Always test with a separate Zotero profile and data directory** (start Zotero
with `-P` to open the profile manager), with a test group — never with your real
library. Then:

```sh
SAFE_EDIT_TOKEN=… TEST_GROUP=… TEST_ITEM=… tests/guard-tests.sh
```

### Manual tests

- Auto-sync on → `apply` refused; off → allowed.
- No backup / backup older than the limit → `apply` refused; after `backup` allowed.
- Item in the trash, a note, an attachment → rejected in `preview`.
- Field the item type does not have → rejected.
- Long list: *Approve* disabled until scrolled to the end; short list: enabled.
- Change a field in Zotero while the dialog is open → that change is skipped.
- Long `extra` and title values are shown in full; differences highlighted,
  incl. non-breaking spaces and dashes.
- Undo restores the old value; blocked after a manual edit of the field.
- Restore from snapshot: values back, item keys unchanged.
- Revoked token → refused. Plugin disabled and enabled again → works, no errors.
