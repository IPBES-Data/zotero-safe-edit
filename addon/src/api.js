/* global Zotero, SafeEdit */

// Direct interface for other Zotero plugins, with the same checks, approval
// dialog and log as the endpoints:
//
//   var safeEdit = await Zotero.SafeEdit.api.connect({ pluginID, name });
//   await safeEdit.preview(changes);
//
// An edit session (beginSession) checks the backup once, at its start; its ID
// is passed to preview and apply (see SafeEdit.sessions).
//
// The user is asked once whether the plugin may propose edits; the plugin is
// then listed (and can be revoked) in Settings → Safe Edit.
SafeEdit.api = {
  async connect({ pluginID, name } = {}) {
    var client =
      SafeEdit.clients.forPlugin(pluginID) ||
      SafeEdit.clients.requestPluginRegistration(pluginID, name);
    if (!client) {
      throw new Error("Safe Edit: not allowed by the user");
    }
    return this._bound(pluginID);
  },

  // functions for one plugin; each call checks that it was not revoked since
  _bound(pluginID) {
    var E = SafeEdit.edits;
    var client = () => {
      var c = SafeEdit.clients.forPlugin(pluginID);
      if (!c) {
        throw new Error("Safe Edit: this plugin is not (or no longer) allowed");
      }
      return c;
    };
    return {
      status: (groupIDs) => E.status(client(), groupIDs),
      backup: (groupID) => (client(), SafeEdit.backup.create(groupID)),
      beginSession: (groupID) => SafeEdit.sessions.begin(client(), groupID),
      endSession: (sessionID) => SafeEdit.sessions.end(client(), sessionID),
      preview: (changes, { session = null } = {}) => E.preview(changes, { client: client(), session }),
      // only the plugin's own undo may link changes to log entries
      apply: (changes, action = "edit", { session = null } = {}) =>
        E.apply(
          (changes || []).map(({ undo_of, ...c }) => c),
          { client: client(), action: action === "restore" ? "restore" : "edit", session }
        ),
      log: (groupID) => (client(), E.history(groupID)),
      undo: (groupID, entryIDs) => E.undo(groupID, entryIDs, client()),
      restore: (groupID, snapshot) => (client(), E.restoreChanges(groupID, snapshot)),
    };
  },
};
