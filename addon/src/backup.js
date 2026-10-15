/* global Zotero, SafeEdit, IOUtils, PathUtils */

// Snapshots of a library: all items as JSON (incl. keys), plus a copy of the
// change log, in <data dir>/safe-edit/backups/<libraryID>/<time>.json.
// Additionally Zotero's own database backup is triggered (separate file
// zotero.sqlite.safe-edit.bak, Zotero's rotating backups are not touched).
SafeEdit.backup = {
  KEEP: 10,

  dir(libraryID) {
    return SafeEdit.util.path("backups", libraryID);
  },

  // ISO time ⇄ file name (no ":" in file names)
  _fileName(time) {
    return time.replace(/[:.]/g, "-") + ".json";
  },

  _timeFromName(name) {
    var m = name.match(/^(\d{4}-\d\d-\d\dT\d\d)-(\d\d)-(\d\d)-(\d+)Z\.json$/);
    return m ? `${m[1]}:${m[2]}:${m[3]}.${m[4]}Z` : null;
  },

  async list(libraryID) {
    var dir = this.dir(libraryID);
    if (!(await IOUtils.exists(dir))) {
      return [];
    }
    var files = (await IOUtils.getChildren(dir))
      .map((p) => PathUtils.filename(p))
      .filter((n) => this._timeFromName(n))
      .sort();
    return files.map((name) => ({
      name,
      file: PathUtils.join(dir, name),
      created: this._timeFromName(name),
    }));
  },

  async latest(libraryID) {
    var all = await this.list(libraryID);
    return all.length ? all[all.length - 1] : null;
  },

  async ageMinutes(libraryID) {
    var last = await this.latest(libraryID);
    return last ? (Date.now() - Date.parse(last.created)) / 60000 : null;
  },

  async create(groupID) {
    var libraryID = SafeEdit.util.libraryID(groupID);
    if (!libraryID) {
      throw new Error(`Group ${groupID} is not in this Zotero`);
    }
    var items = await Zotero.Items.getAll(libraryID, false, true);
    if (Zotero.Items.loadDataTypes) {
      await Zotero.Items.loadDataTypes(items);
    }
    var created = SafeEdit.util.now();
    var snapshot = {
      created,
      group_id: Number(groupID),
      library_id: libraryID,
      group_name: SafeEdit.util.groupName(groupID),
      zotero_version: Zotero.version,
      plugin_version: SafeEdit.version,
      // mode "full" keeps empty fields, so the snapshot shows that they were empty
      items: items.map((item) => item.toJSON({ mode: "full" })),
    };

    var dir = this.dir(libraryID);
    await SafeEdit.util.ensureDir(dir);
    var file = PathUtils.join(dir, this._fileName(created));
    await IOUtils.writeUTF8(file, JSON.stringify(snapshot));
    var log = SafeEdit.log.file(libraryID);
    if (await IOUtils.exists(log)) {
      await IOUtils.copy(log, file.replace(/\.json$/, ".log.jsonl"));
    }

    // keep the newest snapshots only
    var all = await this.list(libraryID);
    for (let old of all.slice(0, Math.max(0, all.length - this.KEEP))) {
      await IOUtils.remove(old.file);
      await IOUtils.remove(old.file.replace(/\.json$/, ".log.jsonl"), {
        ignoreAbsent: true,
      });
    }

    var dbBackup = "not available";
    if (Zotero.DB.backUpDatabase) {
      try {
        var ok = await Zotero.DB.backUpDatabase({
          force: true,
          suffix: "safe-edit",
          online: true,
        });
        dbBackup = ok ? "created" : "not created";
      } catch (e) {
        dbBackup = "failed: " + e.message;
      }
    }

    return { file, created, items: snapshot.items.length, db_backup: dbBackup };
  },

  async load(libraryID, name) {
    var snap = name
      ? (await this.list(libraryID)).find((s) => s.name === name)
      : await this.latest(libraryID);
    if (!snap) {
      throw new Error("No snapshot found");
    }
    return { name: snap.name, data: JSON.parse(await IOUtils.readUTF8(snap.file)) };
  },
};
