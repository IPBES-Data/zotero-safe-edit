// Checks which changes count as adding (or removing) one line: node tests/lines.test.js
const assert = require("assert");
const fs = require("fs");
const prefs = { lineBatches: true, maxBatchSize: 25, maxLineBatchSize: 10000 };
global.SafeEdit = { util: { pref: (k) => prefs[k] } };
eval(fs.readFileSync(__dirname + "/../addon/src/guards.js", "utf8"));
const g = SafeEdit.guards;
const line = (old, neu) => g.lineChange({ old, new: neu });

assert(line("", "OpenAlex: W1"), "line into empty field");
assert(line("PMID: 1", "PMID: 1\nOpenAlex: W1"), "line added");
assert(line("PMID: 1\nOpenAlex: W1", "PMID: 1"), "line removed (undo)");
assert(!line("PMID: 1", "PMID: 2"), "value changed");
assert(!line("A", "A\nB\nC"), "two lines added");
assert(!line("A", "A\n "), "empty line");
assert(!line("A", "XA\nB"), "old value changed too");

const many = Array.from({ length: 30 }, () => ({ old: "", new: "OpenAlex: W1" }));
assert(g.isLineBatch(many), "large batch of added lines");
assert(!g.isLineBatch(many.slice(0, 10)), "small batches are normal batches");
assert(!g.isLineBatch([...many, { old: "a", new: "b" }]), "one other change");
prefs.lineBatches = false;
assert(!g.isLineBatch(many), "not allowed in the settings");
console.log("lines: all checks passed");
