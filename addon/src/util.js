/* global Zotero, SafeEdit, IOUtils, PathUtils */

SafeEdit.util = {
  PREF_PREFIX: "extensions.safe-edit.",

  pref(name) {
    return Zotero.Prefs.get(this.PREF_PREFIX + name, true);
  },

  setPref(name, value) {
    Zotero.Prefs.set(this.PREF_PREFIX + name, value, true);
  },

  json(status, obj) {
    return [status, "application/json", JSON.stringify(obj)];
  },

  now() {
    return new Date().toISOString();
  },

  // short random id for log entries and batches (not a secret)
  newID() {
    return Date.now().toString(36) + "-" + Zotero.Utilities.randomString(8);
  },

  // <Zotero data directory>/safe-edit/...
  path(...parts) {
    return PathUtils.join(Zotero.DataDirectory.dir, "safe-edit", ...parts.map(String));
  },

  async ensureDir(path) {
    await IOUtils.makeDirectory(path, { createAncestors: true, ignoreExisting: true });
  },

  async appendText(path, text) {
    if (await IOUtils.exists(path)) {
      await IOUtils.writeUTF8(path, text, { mode: "append" });
    } else {
      await IOUtils.writeUTF8(path, text);
    }
  },

  // local library of a Zotero group, or null if the group is not in this Zotero
  libraryID(groupID) {
    var id = Zotero.Groups.getLibraryIDFromGroupID(Number(groupID));
    return id || null;
  },

  // item with all its data loaded (Zotero loads item data on demand), or null
  async getItem(libraryID, key) {
    var item = await Zotero.Items.getByLibraryAndKeyAsync(libraryID, String(key));
    if (item && item.loadAllData) {
      await item.loadAllData();
    }
    return item || null;
  },

  groupName(groupID) {
    var group = Zotero.Groups.get(Number(groupID));
    return group ? group.name : String(groupID);
  },
};
