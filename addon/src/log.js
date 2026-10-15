/* global SafeEdit, IOUtils */

// Append-only change log, one JSON line per record and one file per library:
// <data dir>/safe-edit/log/<libraryID>.jsonl
//
// Records:
//   {type: "entry", id, batch_id, time, client, group_id, library_id, item_key,
//    title, field, old, new, action, undo_of, status, reason, scrolled_to_end,
//    plugin_version, zotero_version}
//   {type: "status", id, time, status, error}   (completes a pending entry)
// Existing lines are never changed.
SafeEdit.log = {
  file(libraryID) {
    return SafeEdit.util.path("log", libraryID + ".jsonl");
  },

  async append(libraryID, record) {
    await SafeEdit.util.ensureDir(SafeEdit.util.path("log"));
    await SafeEdit.util.appendText(this.file(libraryID), JSON.stringify(record) + "\n");
  },

  // entries with their final status, in order of creation
  async read(libraryID) {
    var file = this.file(libraryID);
    if (!(await IOUtils.exists(file))) {
      return [];
    }
    var entries = new Map();
    var lines = (await IOUtils.readUTF8(file)).split("\n").filter(Boolean);
    for (let line of lines) {
      var rec = JSON.parse(line);
      if (rec.type === "entry") {
        entries.set(rec.id, rec);
      } else if (rec.type === "status" && entries.has(rec.id)) {
        Object.assign(entries.get(rec.id), {
          status: rec.status,
          status_time: rec.time,
          error: rec.error || null,
        });
      }
    }
    return [...entries.values()];
  },
};
