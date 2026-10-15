// Checks which changes count as adding (or removing) one line: node tests/lines.test.js
const assert = require("assert");
const fs = require("fs");
const prefs = { lineBatches: true, maxBatchSize: 25, maxLineBatchSize: 10000 };
global.SafeEdit = { util: { pref: (k) => prefs[k] } };
eval(fs.readFileSync(__dirname + "/../addon/src/guards.js", "utf8"));
const g = SafeEdit.guards;
const line = (old, neu, field = "extra") => g.lineChange({ field, old, new: neu });

assert(line("", "OpenAlex: W1"), "line into empty field");
assert(line("PMID: 1", "PMID: 1\nOpenAlex: W1"), "line added");
assert(line("PMID: 1\nOpenAlex: W1", "PMID: 1"), "line removed (undo)");
assert(!line("PMID: 1", "PMID: 2"), "value changed");
assert(!line("A", "A\nB\nC"), "two lines added");
assert(!line("A", "A\n "), "empty line");
assert(!line("A", "XA\nB"), "old value changed too");
assert(!line("", "10.1/x", "DOI"), "filling another field is not adding a line");
assert(!line("A", "A\nB", "title"), "only the Extra field");

const many = Array.from({ length: 30 }, () => ({ field: "extra", old: "", new: "OpenAlex: W1" }));
assert(g.isLineBatch(many), "large batch of added lines");
assert(!g.isLineBatch(many.slice(0, 10)), "small batches are normal batches");
assert(!g.isLineBatch([...many, { field: "extra", old: "a", new: "b" }]), "one other change");
assert(!g.isLineBatch(many.map((c) => ({ ...c, field: "DOI", new: "10.1/x" }))), "empty DOI fields filled");
prefs.lineBatches = false;
assert(!g.isLineBatch(many), "not allowed in the settings");
console.log("lines: all checks passed");
