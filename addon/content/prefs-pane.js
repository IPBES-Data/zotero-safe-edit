/* global Zotero, document */

var SafeEditPrefs = {
  init() {
    this.render();
  },

  render() {
    var box = document.getElementById("safe-edit-clients");
    if (!box || !Zotero.SafeEdit) return;
    box.replaceChildren();
    var clients = Zotero.SafeEdit.clients.list();
    if (!clients.length) {
      box.append(document.createTextNode("No applications yet."));
    }
    for (let c of clients) {
      var line = document.createElement("div");
      line.className = "client" + (c.revoked ? " revoked" : "");
      line.append(
        document.createTextNode(
          `${c.name} — added ${c.created.slice(0, 10)}` +
            (c.revoked ? `, revoked ${c.revoked.slice(0, 10)}` : "")
        )
      );
      if (!c.revoked) {
        var btn = document.createElement("button");
        btn.textContent = "Revoke";
        btn.addEventListener("click", () => {
          Zotero.SafeEdit.clients.revoke(c.id);
          this.render();
        });
        line.append(btn);
      }
      box.append(line);
    }
  },

  add() {
    var input = document.getElementById("safe-edit-new-client");
    var out = document.getElementById("safe-edit-token");
    try {
      var token = Zotero.SafeEdit.clients.add(input.value);
      out.textContent =
        "Token (shown only once — copy it into the application now): " + token;
      input.value = "";
    } catch (e) {
      out.textContent = e.message;
    }
    this.render();
  },
};
