# Changelog

## 0.2.1

- Downloads and updates through the IPBES Literature Report website.
- Restore: the changes say which backup they restore by its date and time, not
  its file name.

## 0.2.0

- Direct interface for other Zotero plugins, `Zotero.SafeEdit.api`: the same
  checks, approval dialog and log as the endpoints. The user allows a plugin
  once; it is listed (and can be revoked) in Settings → Safe Edit.
- Tests inside Zotero: `tests/zotero/run.sh` starts a separate Zotero with
  its own test profile and runs `tests/zotero/*.test.js` in it.

## 0.1.8

- Settings: the list of applications is updated while the settings are open,
  e.g. when an application registers itself.

## 0.1.7

- Settings: the list of applications (with *Revoke*) is shown again; Zotero
  does not call `onload` of plugin settings panes.
- Settings: the field for the allowed fields uses the full width.

## 0.1.6

- Line batches only for the Extra field. Filling an empty field (e.g. many
  empty DOI fields) counted as adding a line, so it escaped the batch limit.
- Guard tests for line batches (with `preview`, no dialog opens).

## 0.1.5

- Line batches (off by default, Settings → Safe Edit): large batches (at most
  10,000) of changes which only add one line at the end of a field, or remove
  it again for an undo, approved as a whole in a compact dialog with an
  "I have checked the list" tick box; progress while writing.
- `status` reports `line_batches` and `max_line_batch_size`; log entries
  record `line_batch`.

## 0.1.4

- `preview` reports the current value of a field also when the change is
  refused, e.g. to see whether a change was made already.

## 0.1.3

- Item data is loaded before it is read (fixes "Item data not loaded").

## 0.1.2

- First version: endpoints `register`, `status`, `backup`, `preview`,
  `apply`, `log`, `undo`, `restore`; safeguards (registered applications,
  auto-sync off, fresh backup, allowed fields, expected old value, batch
  limit); approval dialog with highlighted differences; append-only log,
  undo and restore from snapshots; settings pane.
