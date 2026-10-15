/* global Zotero, SafeEdit */

// Checks a batch of changes, asks for approval and writes the approved ones.
// Used for edits, undos and restores alike.
SafeEdit.edits = {
  // preview: checks and diffs, nothing is written
  async preview(changes) {
    var blockers = await SafeEdit.guards.batch(changes);
    var rows = await this._rows(changes || []);
    return { blockers, rows: rows.map((r) => this._public(r)) };
  },

  async _rows(changes) {
    var rows = [];
    for (let [index, c] of changes.entries()) {
      var check = await SafeEdit.guards.change(c);
      rows.push({
        index,
        change: c,
        ok: check.ok,
        reason: check.reason,
        item: check.item || null,
        libraryID: check.libraryID || null,
        current: check.current,
        title: check.item ? check.item.getDisplayTitle() : "",
        item_type: check.item ? Zotero.ItemTypes.getName(check.item.itemTypeID) : "",
        group: c && c.group_id ? SafeEdit.util.groupName(c.group_id) : "",
        diff: c ? SafeEdit.diff.compute(c.old, c.new, c.field) : null,
      });
    }
    return rows;
  },

  // row without Zotero objects, for JSON responses and the dialog
  _public(r) {
    return {
      index: r.index,
      group_id: r.change && r.change.group_id,
      group: r.group,
      item_key: r.change && r.change.item_key,
      title: r.title,
      item_type: r.item_type,
      field: r.change && r.change.field,
      old: r.change && r.change.old,
      new: r.change && r.change.new,
      reason_for_change: r.change && r.change.reason,
      ok: r.ok,
      problem: r.reason,
      current: r.current,
      diff: r.diff,
    };
  },

  _entry(r, { batchID, client, action, scrolled, status, reason }) {
    var c = r.change;
    return {
      type: "entry",
      id: SafeEdit.util.newID(),
      batch_id: batchID,
      time: SafeEdit.util.now(),
      client: client.name,
      group_id: Number(c.group_id),
      library_id: r.libraryID,
      item_key: String(c.item_key),
      title: r.title,
      field: c.field,
      old: c.old,
      new: c.new,
      action,
      undo_of: c.undo_of || null,
      reason_for_change: c.reason || null,
      status,
      reason: reason || null,
      scrolled_to_end: scrolled,
      plugin_version: SafeEdit.version,
      zotero_version: Zotero.version,
    };
  },

  async apply(changes, { client, action }) {
    var blockers = await SafeEdit.guards.batch(changes);
    if (blockers.length) {
      return { status: "refused", reasons: blockers };
    }
    var rows = await this._rows(changes);
    if (!rows.some((r) => r.ok)) {
      return { status: "nothing to apply", rows: rows.map((r) => this._public(r)) };
    }

    var batchID = SafeEdit.util.newID();
    var decision = await SafeEdit.dialog.open(
      rows.map((r) => this._public(r)),
      { client: client.name, action, batch_id: batchID }
    );
    if (decision.cancelled) {
      return { status: "cancelled", batch_id: batchID };
    }

    var approved = new Set(decision.approved);
    var scrolled = !!decision.scrolled_to_end;
    var meta = { batchID, client, action, scrolled };
    var results = [];

    for (let r of rows) {
      var result = { index: r.index, item_key: r.change.item_key, field: r.change.field };
      if (!r.ok) {
        results.push({ ...result, status: "rejected", reason: r.reason });
        continue;
      }
      if (!approved.has(r.index)) {
        await SafeEdit.log.append(r.libraryID, this._entry(r, { ...meta, status: "deselected" }));
        results.push({ ...result, status: "deselected" });
        continue;
      }

      // check again: the item may have changed while the dialog was open
      var check = await SafeEdit.guards.change(r.change);
      if (!check.ok) {
        await SafeEdit.log.append(
          r.libraryID,
          this._entry(r, { ...meta, status: "skipped", reason: check.reason })
        );
        results.push({ ...result, status: "skipped", reason: check.reason });
        continue;
      }

      // log first, then write, then complete the log entry
      var entry = this._entry(r, { ...meta, status: "pending" });
      await SafeEdit.log.append(r.libraryID, entry);
      try {
        check.item.setField(r.change.field, r.change.new);
        await check.item.saveTx();
        await SafeEdit.log.append(r.libraryID, {
          type: "status",
          id: entry.id,
          time: SafeEdit.util.now(),
          status: "applied",
        });
        results.push({ ...result, status: "applied", log_id: entry.id });
      } catch (e) {
        Zotero.logError(e);
        await SafeEdit.log.append(r.libraryID, {
          type: "status",
          id: entry.id,
          time: SafeEdit.util.now(),
          status: "failed",
          error: String(e.message || e),
        });
        results.push({ ...result, status: "failed", reason: String(e.message || e) });
      }
    }
    return { status: "done", batch_id: batchID, scrolled_to_end: scrolled, results };
  },

  // log entries with the current state of each applied change
  async history(groupID) {
    var libraryID = SafeEdit.util.libraryID(groupID);
    if (!libraryID) {
      throw new Error(`Group ${groupID} is not in this Zotero`);
    }
    var entries = await SafeEdit.log.read(libraryID);
    var undone = new Set(
      entries
        .filter((e) => e.action === "undo" && e.status === "applied" && e.undo_of)
        .map((e) => e.undo_of)
    );
    for (let e of entries) {
      e.undone = undone.has(e.id);
      if (e.status !== "applied") {
        continue;
      }
      var item = await SafeEdit.util.getItem(libraryID, e.item_key);
      if (!item) {
        e.state = "item not found";
        continue;
      }
      var current = item.getField(e.field) || "";
      e.current = current;
      e.state = current === e.new ? "unchanged since" : "changed since";
      e.synced = !!item.synced;
    }
    return entries;
  },

  // reverse applied log entries (same checks and dialog as any edit)
  async undo(groupID, entryIDs, client) {
    var entries = await this.history(groupID);
    var wanted = new Set(entryIDs || []);
    var changes = [];
    var refused = [];
    for (let e of entries.filter((e) => wanted.has(e.id))) {
      if (e.status !== "applied") {
        refused.push({ id: e.id, reason: `Not applied (${e.status})` });
      } else if (e.undone) {
        refused.push({ id: e.id, reason: "Already undone" });
      } else {
        changes.push({
          group_id: e.group_id,
          item_key: e.item_key,
          field: e.field,
          old: e.new,
          new: e.old,
          undo_of: e.id,
          reason: "Undo of change " + e.id,
        });
      }
    }
    if (!changes.length) {
      return { status: "nothing to undo", refused };
    }
    var result = await this.apply(changes, { client, action: "undo" });
    return { ...result, refused };
  },

  // changes which bring the allowed fields back to the values of a snapshot;
  // they are applied by the client in batches with action "restore"
  async restoreChanges(groupID, snapshotName) {
    var libraryID = SafeEdit.util.libraryID(groupID);
    if (!libraryID) {
      throw new Error(`Group ${groupID} is not in this Zotero`);
    }
    var { name, data } = await SafeEdit.backup.load(libraryID, snapshotName);
    var allowed = SafeEdit.guards.allowedFields();
    var changes = [];
    var notRestored = [];
    var missing = [];
    for (let snap of data.items) {
      if (["note", "attachment", "annotation"].includes(snap.itemType)) {
        continue;
      }
      var item = await SafeEdit.util.getItem(libraryID, snap.key);
      if (!item) {
        missing.push(snap.key);
        continue;
      }
      var json = item.toJSON();
      // the allowed fields are always compared: older snapshots leave out
      // empty fields, so a missing field means it was empty
      var fields = new Set([...Object.keys(snap), ...allowed]);
      for (let field of fields) {
        var fieldID = Zotero.ItemFields.getID(field);
        if (!fieldID || !Zotero.ItemFields.isValidForType(fieldID, item.itemTypeID)) {
          continue;
        }
        var before = snap[field] || "";
        var now = item.getField(field) || "";
        if (before === now) {
          continue;
        }
        if (allowed.includes(field)) {
          changes.push({
            group_id: Number(groupID),
            item_key: snap.key,
            field,
            old: now,
            new: before,
            reason: "Restore from snapshot " + name,
          });
        } else {
          notRestored.push({ item_key: snap.key, field, snapshot: before, current: now });
        }
      }
      for (let k of ["creators", "tags", "collections"]) {
        if (JSON.stringify(snap[k] || []) !== JSON.stringify(json[k] || [])) {
          notRestored.push({ item_key: snap.key, field: k });
        }
      }
    }
    return { snapshot: name, changes, not_restored: notRestored, missing };
  },
};
