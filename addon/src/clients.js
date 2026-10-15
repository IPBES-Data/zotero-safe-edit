/* global Zotero, SafeEdit, Cc, Ci, Services */

// Client applications allowed to send requests. Each has a name and a token;
// only a SHA-256 hash of the token is stored.
SafeEdit.clients = {
  _load() {
    try {
      return JSON.parse(SafeEdit.util.pref("clients") || "[]");
    } catch (e) {
      return [];
    }
  },

  _save(list) {
    SafeEdit.util.setPref("clients", JSON.stringify(list));
  },

  _hash(token) {
    var ch = Cc["@mozilla.org/security/hash;1"].createInstance(Ci.nsICryptoHash);
    ch.init(ch.SHA256);
    var bytes = Array.from(new TextEncoder().encode(token));
    ch.update(bytes, bytes.length);
    return ch.finish(true);
  },

  _newToken() {
    var rg = Cc["@mozilla.org/security/random-generator;1"].getService(
      Ci.nsIRandomGenerator
    );
    return Array.from(rg.generateRandomBytes(32), (b) =>
      b.toString(16).padStart(2, "0")
    ).join("");
  },

  // creates a client and returns its token (shown only once)
  add(name) {
    name = String(name || "").trim();
    if (!name) {
      throw new Error("A client needs a name");
    }
    var token = this._newToken();
    var list = this._load();
    list.push({
      id: SafeEdit.util.newID(),
      name,
      hash: this._hash(token),
      created: SafeEdit.util.now(),
      revoked: null,
    });
    this._save(list);
    return token;
  },

  revoke(id) {
    var list = this._load();
    for (let c of list) {
      if (c.id === id && !c.revoked) {
        c.revoked = SafeEdit.util.now();
      }
    }
    this._save(list);
  },

  // clients without their token hashes
  list() {
    return this._load().map(({ hash, ...c }) => c);
  },

  // client for a token, or null if unknown or revoked
  authenticate(token) {
    if (!token || typeof token != "string") {
      return null;
    }
    var hash = this._hash(token);
    return this._load().find((c) => c.hash === hash && !c.revoked) || null;
  },

  // registration requested by an application: the user has to confirm it
  _registrations: [],

  requestRegistration(name) {
    // at most 5 confirmation dialogs per minute
    var now = Date.now();
    this._registrations = this._registrations.filter((t) => now - t < 60000);
    if (this._registrations.length >= 5) {
      return { error: "Too many registration requests, try again in a minute" };
    }
    this._registrations.push(now);

    name = String(name || "").trim();
    if (!name) {
      return { error: "A client needs a name" };
    }
    var ok = Services.prompt.confirm(
      Zotero.getMainWindow(),
      "Safe Edit: new application",
      `The application "${name}" asks for permission to propose edits to your ` +
        "Zotero items.\n\nEvery edit still has to be approved by you in Zotero. " +
        "You can revoke this permission at any time in Settings → Safe Edit.\n\n" +
        "Allow?"
    );
    if (!ok) {
      return { denied: true };
    }
    return { name, token: this.add(name) };
  },
};
