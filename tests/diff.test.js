// Tests of addon/src/diff.js outside Zotero: node tests/diff.test.js
const fs = require("fs");
const path = require("path");
const assert = require("assert");

global.SafeEdit = {};
eval(fs.readFileSync(path.join(__dirname, "../addon/src/diff.js"), "utf8"));
const d = SafeEdit.diff;

const join = (segs, types) =>
  segs.filter((s) => types.includes(s.type)).map((s) => s.text).join("");

// old and new values can be rebuilt from the segments
for (const [a, b, f] of [
  ["Reimagining futures: Collaborations between artists", "Reimagining futures", "title"],
  ["10.1525/elementa.2021.00016", "10.1525/elementa.2021.0016", "DOI"],
  ["", "10.1000/xyz", "DOI"],
  ["A title", "", "title"],
  ["same", "same", "title"],
]) {
  const r = d.compute(a, b, f);
  assert.strictEqual(join(r.segments, ["same", "removed"]), a, `old of ${a}`);
  assert.strictEqual(join(r.segments, ["same", "added"]), b, `new of ${b}`);
}

// identifiers by character: one removed character
let r = d.compute("10.1525/elementa.2021.00016", "10.1525/elementa.2021.0016", "DOI");
assert.strictEqual(r.mode, "characters");
assert.deepStrictEqual(
  r.segments.filter((s) => s.type !== "same").map((s) => [s.type, s.text]),
  [["removed", "0"]]
);

// text by word: the removed subtitle is one segment
r = d.compute("Reimagining futures: Collaborations between artists", "Reimagining futures", "title");
assert.strictEqual(r.mode, "words");
assert.deepStrictEqual(
  r.segments.map((s) => [s.type, s.text]),
  [["same", "Reimagining futures"], ["removed", ": Collaborations between artists"]]
);

// look-alike characters are made visible and explained
r = d.compute("Land-use change", "Land–use change", "title");
assert.ok(r.notes.includes("added: en dash"), JSON.stringify(r.notes));
assert.ok(r.notes.includes("added: non-breaking space"), JSON.stringify(r.notes));
assert.ok(r.segments.some((s) => s.type === "added" && s.display.includes("⍽")));

// case only
r = d.compute("Nature futures", "Nature Futures", "title");
assert.ok(r.notes.includes("only upper/lower case differs"));

// double spaces are visible
r = d.compute("A title", "A  title", "title");
assert.ok(r.segments.some((s) => s.type === "added" && s.display === "··"), JSON.stringify(r.segments));

// very long values fall back to whole removed / added
const big = "x".repeat(3000);
r = d.compute(big, big + "y", "DOI");
assert.strictEqual(join(r.segments, ["same", "removed"]), big);

console.log("diff tests passed");
