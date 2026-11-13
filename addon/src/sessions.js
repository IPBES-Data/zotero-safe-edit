/* global Zotero, SafeEdit */

// Edit sessions: a client checks the backup once, when it starts working
// through a list of changes (e.g. one kind of fix), instead of with every
// batch. The backup made before the session is the restore point for all its
// changes, however long the session takes. A session stays valid until the
// client ends it, the group is synced (the backup then no longer matches the
// library) or Zotero quits (sessions are kept in memory only). All other
// checks still apply to every batch.
SafeEdit.sessions = {
  _open: new Map(),

  // changes with every sync of the library
  _syncState(libraryID) {
    var lib = Zotero.Libraries.get(libraryID);
    if (!lib) return null;
    var last = lib.lastSync ? new Date(lib.lastSync).getTime() : 0;
    return last + "|" + lib.libraryVersion;
  },

  // starts a session for the group if its backup is fresh enough; a client
  // has at most one session per group
  async begin(client, groupID) {
    var libraryID = SafeEdit.util.libraryID(groupID);
    if (!libraryID) {
      return { status: "refused", reasons: [`Group ${groupID} is not in this Zotero`] };
    }
    var reasons = await SafeEdit.guards.backupReasons(groupID, libraryID);
    if (reasons.length) {
      return { status: "refused", reasons };
    }
    var backup = await SafeEdit.backup.latest(libraryID);
    // no await from here on: two calls at once leave one session
    for (let [id, s] of this._open) {
      if (s.client_id === client.id && s.group_id === Number(groupID)) this._open.delete(id);
    }
    var id = SafeEdit.util.newID();
    this._open.set(id, {
      client_id: client.id,
      group_id: Number(groupID),
      library_id: libraryID,
      sync: this._syncState(libraryID),
      started: SafeEdit.util.now(),
    });
    return { status: "started", session_id: id, backup: backup.created };
  },

  end(client, id) {
    var s = this._open.get(id);
    if (!s || s.client_id !== client.id) return { ended: false };
    this._open.delete(id);
    return { ended: true };
  },

  // whether the session lets this client skip the backup check for the group;
  // a session whose group was synced since is ended
  covers(id, client, groupID) {
    var s = id ? this._open.get(id) : null;
    if (!s || !client || s.client_id !== client.id || s.group_id !== Number(groupID)) {
      return false;
    }
    if (s.sync !== this._syncState(s.library_id)) {
      this._open.delete(id);
      return false;
    }
    return true;
  },
};
