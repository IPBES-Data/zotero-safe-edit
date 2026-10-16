/* global Zotero, Services, test, assert */

// Tests of Safe Edit inside Zotero (run by tests/zotero/run.sh). They work in a
// local test group in the test profile; the approval dialog is answered by the
// tests (stubbed, or the real dialog clicked through).

var S = Zotero.SafeEdit;
var client = { name: "Tests" };
var GROUP_ID = 9990001;
var group = null;

async function testGroup() {
  if (!group) {
    group = new Zotero.Group();
    group.id = GROUP_ID;
    group.name = "Safe Edit test group";
    group.description = "";
    group.editable = true;
    group.filesEditable = true;
    group.version = 1;
    group.archived = false;
    await group.saveTx();
  }
  return group;
}

async function newItem(fields = {}, type = "journalArticle") {
  var g = await testGroup();
  var item = new Zotero.Item(type);
  item.libraryID = g.libraryID;
  item.setField("title", fields.title || "Test item " + Zotero.Utilities.randomString(6));
  for (let [k, v] of Object.entries(fields)) {
    if (k !== "title") item.setField(k, v);
  }
  await item.saveTx();
  return item;
}

function change(item, field, oldValue, newValue) {
  return { group_id: GROUP_ID, item_key: item.key, field, old: oldValue, new: newValue, reason: "test" };
}

// answers the approval dialog: approves all valid changes (or cancels)
function stubDialog({ cancel = false } = {}) {
  var original = S.dialog.open;
  S.dialog.open = async (rows) =>
    cancel ? { cancelled: true } : { approved: rows.filter((r) => r.ok).map((r) => r.index), scrolled_to_end: true };
  return () => (S.dialog.open = original);
}

async function freshBackup() {
  await S.backup.create(GROUP_ID);
}

test("Safe Edit is loaded, with its direct interface", async () => {
  assert.ok(S && S.version, "Zotero.SafeEdit");
  assert.ok(S.api && S.api.connect, "Zotero.SafeEdit.api");
});

test("status reports the test group", async () => {
  await testGroup();
  var s = await S.edits.status(client, [GROUP_ID]);
  assert.equal(s.groups[0].in_zotero, true, "in_zotero");
  assert.equal(s.groups[0].editable, true, "editable");
  assert.equal(s.auto_sync, false, "auto_sync");
});

test("preview: valid change ok, with the current value", async () => {
  var item = await newItem({ DOI: "" });
  var pv = await S.edits.preview([change(item, "DOI", "", "10.1/abc")]);
  assert.equal(pv.rows[0].ok, true, "ok");
  assert.equal(pv.rows[0].current, "", "current");
});

test("preview: field not allowed, wrong old value, unknown item are rejected", async () => {
  var item = await newItem({ DOI: "10.1/x" });
  var pv = await S.edits.preview([
    change(item, "title", item.getField("title"), "New title"),
    change(item, "DOI", "10.1/other", "10.1/y"),
    { group_id: GROUP_ID, item_key: "ZZZZZZZZ", field: "DOI", old: "", new: "10.1/z" },
  ]);
  assert.match(pv.rows[0].problem, /not allowed/, "field");
  assert.match(pv.rows[1].problem, /differs from the expected old value/, "old value");
  assert.match(pv.rows[2].problem, /Item not found/, "item");
});

test("apply is refused without a fresh backup", async () => {
  var item = await newItem();
  var prefs = "extensions.safe-edit.maxBackupAgeMinutes";
  Zotero.Prefs.set(prefs, 1, true);
  try {
    // runs before any backup is made in the new test data directory
    var r = await S.edits.apply([change(item, "DOI", "", "10.1/backup")], { client, action: "edit" });
    if (r.status === "refused") {
      assert.match(r.reasons.join(" "), /backup/i, "reason");
    } else {
      throw new Error("not refused: " + r.status);
    }
  } finally {
    Zotero.Prefs.set(prefs, 60, true);
  }
});

test("apply writes approved changes and logs them; undo restores", async () => {
  var item = await newItem({ DOI: "" });
  await freshBackup();
  var restore = stubDialog();
  try {
    var r = await S.edits.apply([change(item, "DOI", "", "10.1/applied")], { client, action: "edit" });
    assert.equal(r.status, "done", "status");
    assert.equal(r.results[0].status, "applied", "result");
    var reloaded = await Zotero.Items.getAsync(item.id);
    assert.equal(reloaded.getField("DOI"), "10.1/applied", "written");

    var log = await S.edits.history(GROUP_ID);
    var entry = log.find((e) => e.item_key === item.key && e.status === "applied");
    assert.ok(entry, "log entry");

    var u = await S.edits.undo(GROUP_ID, [entry.id], client);
    assert.equal(u.status, "done", "undo status");
    assert.equal((await Zotero.Items.getAsync(item.id)).getField("DOI"), "", "undone");
  } finally {
    restore();
  }
});

test("cancelled approval writes nothing", async () => {
  var item = await newItem({ DOI: "" });
  await freshBackup();
  var restore = stubDialog({ cancel: true });
  try {
    var r = await S.edits.apply([change(item, "DOI", "", "10.1/cancelled")], { client, action: "edit" });
    assert.equal(r.status, "cancelled", "status");
    assert.equal((await Zotero.Items.getAsync(item.id)).getField("DOI"), "", "unchanged");
  } finally {
    restore();
  }
});

test("line batches: only added Extra lines escape the batch limit", async () => {
  var items = [];
  for (let i = 0; i < 30; i++) items.push(await newItem());
  var lines = items.map((it, i) => change(it, "extra", "", "OpenAlex: W" + i));
  var dois = items.map((it, i) => change(it, "DOI", "", "10.1/" + i));
  Zotero.Prefs.set("extensions.safe-edit.lineBatches", true, true);
  try {
    var a = await S.edits.preview(lines);
    assert.ok(!a.blockers.some((b) => /Too many/.test(b)), "Extra lines accepted");
    var b = await S.edits.preview(dois);
    assert.ok(b.blockers.some((x) => /Too many/.test(x)), "DOIs refused");
  } finally {
    Zotero.Prefs.set("extensions.safe-edit.lineBatches", false, true);
  }
  var c = await S.edits.preview(lines);
  assert.ok(c.blockers.some((x) => /Too many/.test(x)), "Extra lines refused when off");
});

test("the real approval dialog can be approved by a test", async () => {
  var item = await newItem({ DOI: "" });
  await freshBackup();
  var pending = S.edits.apply([change(item, "DOI", "", "10.1/dialog")], { client, action: "edit" });

  // wait for the dialog, then scroll to the end and approve
  var win = null;
  for (let i = 0; i < 100 && !win; i++) {
    await Zotero.Promise.delay(100);
    for (let w of Services.wm.getEnumerator(null)) {
      if (String(w.location).includes("approve.xhtml") && w.document.readyState === "complete") win = w;
    }
  }
  assert.ok(win, "dialog opened");
  var list = win.document.getElementById("rows");
  list.scrollTop = list.scrollHeight;
  list.dispatchEvent(new win.Event("scroll"));
  var approve = win.document.getElementById("approve");
  assert.equal(approve.disabled, false, "Approve enabled after scrolling");
  approve.click();

  var r = await pending;
  assert.equal(r.results[0].status, "applied", "applied");
  assert.equal((await Zotero.Items.getAsync(item.id)).getField("DOI"), "10.1/dialog", "written");
});

test("restore: changes back to a backup, described by its date and time", async () => {
  var item = await newItem({ DOI: "10.1/before" });
  await freshBackup();
  var backups = (await S.edits.status(client, [GROUP_ID])).groups[0].backups;
  item.setField("DOI", "10.1/after");
  await item.saveTx();
  var r = await S.edits.restoreChanges(GROUP_ID, backups[0].name);
  var c = r.changes.find((x) => x.item_key === item.key);
  assert.ok(c, "difference found");
  assert.equal(c.new, "10.1/before", "back to the backup");
  assert.equal(c.reason, "Restore from the backup of " + new Date(backups[0].created).toLocaleString(), "reason");
});

test("direct interface: asks once, works, refuses after revoking", async () => {
  var asked = 0;
  var original = S.clients._confirm;
  S.clients._confirm = () => (++asked, true);
  try {
    var api = await S.api.connect({ pluginID: "tests@example.org", name: "Test plugin" });
    await S.api.connect({ pluginID: "tests@example.org", name: "Test plugin" });
    assert.equal(asked, 1, "asked once");

    var item = await newItem({ DOI: "" });
    var pv = await api.preview([change(item, "DOI", "", "10.1/api")]);
    assert.equal(pv.rows[0].ok, true, "preview");
    var s = await api.status([GROUP_ID]);
    assert.equal(s.client, "Test plugin", "client name");

    await freshBackup();
    var restore = stubDialog();
    try {
      var r = await api.apply([change(item, "DOI", "", "10.1/api")]);
      assert.equal(r.results[0].status, "applied", "applied");
      var log = await api.log(GROUP_ID);
      assert.equal(log.find((e) => e.item_key === item.key).client, "Test plugin", "logged with the plugin's name");
    } finally {
      restore();
    }

    S.clients.revoke(S.clients.forPlugin("tests@example.org").id);
    var refused = false;
    try {
      await api.preview([change(item, "DOI", "10.1/api", "10.1/after")]);
    } catch (e) {
      refused = /not \(or no longer\) allowed/.test(e.message);
    }
    assert.ok(refused, "refused after revoking");

    S.clients._confirm = () => false;
    var denied = false;
    try {
      await S.api.connect({ pluginID: "other@example.org", name: "Other" });
    } catch (e) {
      denied = /not allowed by the user/.test(e.message);
    }
    assert.ok(denied, "denied by the user");
  } finally {
    S.clients._confirm = original;
  }
});
