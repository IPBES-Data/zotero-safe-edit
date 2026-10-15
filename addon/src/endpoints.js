/* global Zotero, SafeEdit */

// Endpoints on Zotero's local server (localhost:23119). Zotero itself only
// accepts requests to localhost and drops requests coming from web pages
// (any Origin header); `allowRequestsFromUnsafeWebContent` is never set.
// All endpoints except `register` need the header X-Safe-Edit-Token.
SafeEdit.endpoints = {
  PREFIX: "/safe-edit/",
  _paths: [],

  _define(name, handler, { auth = true } = {}) {
    var path = this.PREFIX + name;
    var Endpoint = function () {};
    Endpoint.prototype = {
      supportedMethods: ["POST"],
      supportedDataTypes: ["application/json"],
      async init(request) {
        try {
          var client = null;
          if (auth) {
            client = SafeEdit.clients.authenticate(request.headers["x-safe-edit-token"]);
            if (!client) {
              return SafeEdit.util.json(401, { error: "Missing, unknown or revoked token" });
            }
          }
          var body = request.data && typeof request.data == "object" ? request.data : {};
          return SafeEdit.util.json(200, await handler(body, client));
        } catch (e) {
          Zotero.logError(e);
          return SafeEdit.util.json(500, { error: String(e.message || e) });
        }
      },
    };
    Zotero.Server.Endpoints[path] = Endpoint;
    this._paths.push(path);
  },

  register() {
    var E = SafeEdit.edits;

    this._define(
      "register",
      async (body) => SafeEdit.clients.requestRegistration(body.name),
      { auth: false }
    );

    this._define("status", async (body, client) => {
      var groups = [];
      for (let groupID of body.group_ids || []) {
        var libraryID = SafeEdit.util.libraryID(groupID);
        var last = libraryID ? await SafeEdit.backup.latest(libraryID) : null;
        groups.push({
          group_id: Number(groupID),
          name: libraryID ? SafeEdit.util.groupName(groupID) : null,
          in_zotero: !!libraryID,
          editable: libraryID ? Zotero.Libraries.get(libraryID).editable : false,
          last_backup: last ? last.created : null,
          backup_age_minutes: libraryID ? await SafeEdit.backup.ageMinutes(libraryID) : null,
          // all snapshots, newest first, e.g. to choose one for a restore
          backups: libraryID
            ? (await SafeEdit.backup.list(libraryID))
                .reverse()
                .map((b) => ({ name: b.name, created: b.created }))
            : [],
        });
      }
      return {
        client: client.name,
        plugin_version: SafeEdit.version,
        zotero_version: Zotero.version,
        auto_sync: SafeEdit.guards.autoSync(),
        max_batch_size: SafeEdit.guards.maxBatchSize(),
        max_backup_age_minutes: SafeEdit.guards.maxBackupAgeMinutes(),
        allowed_fields: SafeEdit.guards.allowedFields(),
        groups,
      };
    });

    this._define("backup", async (body) => SafeEdit.backup.create(body.group_id));

    this._define("preview", async (body) => E.preview(body.changes));

    this._define("apply", async (body, client) => {
      var action = body.action === "restore" ? "restore" : "edit";
      // only the plugin's own undo may link changes to log entries
      var changes = Array.isArray(body.changes)
        ? body.changes.map(({ undo_of, ...c }) => c)
        : body.changes;
      return E.apply(changes, { client, action });
    });

    this._define("log", async (body) => ({ entries: await E.history(body.group_id) }));

    this._define("undo", async (body, client) => E.undo(body.group_id, body.entry_ids, client));

    this._define("restore", async (body) => E.restoreChanges(body.group_id, body.snapshot));
  },

  unregister() {
    for (let path of this._paths) {
      delete Zotero.Server.Endpoints[path];
    }
    this._paths = [];
  },
};
