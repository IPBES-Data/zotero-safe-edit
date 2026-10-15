// Writes tests/test-items.json: made-up items (CSL JSON) for a test group.
// Import into the test group with Zotero → File → Import…
// DOIs use the prefix 10.5555, which is reserved for tests. DOIs in Extra are
// written inside a sentence: Zotero moves "DOI: …" lines into the DOI field
// on import, which would spoil the test cases.
const fs = require("fs");
const path = require("path");

const art = (n, extra) => ({
  type: "article-journal",
  title: `Safe Edit test article ${n}`,
  "container-title": "Journal of Test Data",
  author: [{ family: "Tester", given: "Ada" }],
  issued: { "date-parts": [[2024]] },
  ...extra,
});

const items = [
  art("A: DOI as doi.org link in URL", { URL: "https://doi.org/10.5555/safe-edit.a" }),
  art("B: DOI in a publisher URL", { URL: "https://onlinelibrary.wiley.com/doi/10.5555/safe-edit.b" }),
  art("C: DOI only in Extra", { note: "Published version: https://doi.org/10.5555/safe-edit.c" }),
  art("D: different DOIs in URL and Extra (not proposed)", {
    URL: "https://doi.org/10.5555/safe-edit.d1",
    note: "Published version: https://doi.org/10.5555/safe-edit.d2",
  }),
  // a real DOI, so that OpenAlex finds at least one work for the group
  art("E: already has a DOI (nothing to do)", { DOI: "10.1038/s41558-020-00952-0" }),
  art(
    "F: a very long title to check that long values wrap and are shown in full in the " +
      "approval dialog and in the app, without any truncation, horizontal scrolling or " +
      "hidden parts, even when the window is narrow and the text continues for several lines",
    { URL: "https://doi.org/10.5555/safe-edit.f" }
  ),
  art("G: look–alike characters in the title “quotes”", {
    URL: "https://doi.org/10.5555/safe-edit.g",
  }),
  {
    type: "report",
    title: "Safe Edit test report H: DOI in Extra",
    publisher: "Test Institute",
    issued: { "date-parts": [[2023]] },
    note: "Published version: https://doi.org/10.5555/safe-edit.h",
  },
  {
    type: "book",
    title: "Safe Edit test book I: DOI in Extra",
    publisher: "Test Press",
    issued: { "date-parts": [[2022]] },
    note: "Published version: https://doi.org/10.5555/safe-edit.i",
  },
  {
    type: "webpage",
    title: "Safe Edit test web page J: DOI in URL",
    URL: "https://doi.org/10.5555/safe-edit.j",
    issued: { "date-parts": [[2025]] },
  },
];
for (let n = 1; n <= 30; n++) {
  items.push(art(`K${n}: batch test`, { URL: `https://doi.org/10.5555/safe-edit.k${n}` }));
}
items.forEach((it, i) => (it.id = `safe-edit-test-${i + 1}`));

fs.writeFileSync(path.join(__dirname, "test-items.json"), JSON.stringify(items, null, 2));
const fixed = items
  .filter((it) => /^Safe Edit test \w+ [CDHI]:/.test(it.title))
  .map((it) => ({ ...it, id: it.id + "-v2", title: it.title.replace(/ ([CDHI]):/, " $1 (v2):") }));
fs.writeFileSync(path.join(__dirname, "test-items-v2.json"), JSON.stringify(fixed, null, 2));
console.log(`${items.length} test items written to tests/test-items.json`);
