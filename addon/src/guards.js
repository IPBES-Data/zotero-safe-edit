/* global Zotero, SafeEdit */

// Checks before anything is written.
SafeEdit.guards = {
  allowedFields() {
    return String(SafeEdit.util.pref("allowedFields") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  },

  maxBatchSize() {
    return Number(SafeEdit.util.pref("maxBatchSize")) || 25;
  },

  maxBackupAgeMinutes() {
    return Number(SafeEdit.util.pref("maxBackupAgeMinutes")) || 60;
  },

  autoSync() {
    return !!Zotero.Prefs.get("sync.autoSync");
  },

  // reasons why a batch of changes must not be written at all
  async batch(changes) {
    var reasons = [];
    if (!Array.isArray(changes) || !changes.length) {
      reasons.push("No changes given");
      return reasons;
    }
    if (changes.length > this.maxBatchSize()) {
      reasons.push(
        `Too many changes in one batch (${changes.length}, at most ${this.maxBatchSize()})`
      );
    }
    if (this.autoSync()) {
      reasons.push("Automatic sync is on — switch it off in Settings → Sync before editing");
    }
    var groups = [...new Set(changes.map((c) => Number(c.group_id)))];
    for (let groupID of groups) {
      var libraryID = SafeEdit.util.libraryID(groupID);
      if (!libraryID) {
        continue; // reported per change
      }
      var age = await SafeEdit.backup.ageMinutes(libraryID);
      if (age === null) {
        reasons.push(`No backup of group ${SafeEdit.util.groupName(groupID)} — make one first`);
      } else if (age > this.maxBackupAgeMinutes()) {
        reasons.push(
          `Last backup of group ${SafeEdit.util.groupName(groupID)} is ` +
            `${Math.round(age)} minutes old (at most ${this.maxBackupAgeMinutes()}) — make a new one`
        );
      }
    }
    return reasons;
  },

  // checks of a single change; returns {ok, reason, item, libraryID, current}
  async change(c) {
    var fail = (reason, extra = {}) => ({ ok: false, reason, ...extra });

    if (!c || typeof c != "object") return fail("Invalid change");
    for (let k of ["group_id", "item_key", "field"]) {
      if (c[k] === undefined || c[k] === null || c[k] === "") return fail(`Missing ${k}`);
    }
    if (typeof c.old != "string" || typeof c.new != "string") {
      return fail("Old and new value must be text");
    }
    if (c.old === c.new) return fail("Old and new value are the same");

    var libraryID = SafeEdit.util.libraryID(c.group_id);
    if (!libraryID) return fail(`Group ${c.group_id} is not in this Zotero`);

    var item = await SafeEdit.util.getItem(libraryID, c.item_key);
    if (!item) return fail("Item not found", { libraryID });
    if (!Zotero.Libraries.get(libraryID).editable) {
      return fail("You cannot edit this group", { libraryID, item });
    }
    if (!item.isRegularItem()) {
      return fail("Only regular items can be edited (not notes, attachments or annotations)", { libraryID, item });
    }
    if (item.deleted) return fail("Item is in the trash", { libraryID, item });

    if (!this.allowedFields().includes(c.field)) {
      return fail(`Field "${c.field}" is not allowed (Settings → Safe Edit)`, { libraryID, item });
    }
    var fieldID = Zotero.ItemFields.getID(c.field);
    if (!fieldID) return fail(`Unknown field "${c.field}"`, { libraryID, item });
    if (!Zotero.ItemFields.isValidForType(fieldID, item.itemTypeID)) {
      return fail(
        `Item type "${Zotero.ItemTypes.getName(item.itemTypeID)}" has no field "${c.field}"`,
        { libraryID, item }
      );
    }

    var current = item.getField(c.field) || "";
    if (current !== c.old) {
      return fail("The current value differs from the expected old value (item changed since)", {
        libraryID,
        item,
        current,
      });
    }
    return { ok: true, reason: null, libraryID, item, current };
  },
};
