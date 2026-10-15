/* global SafeEdit */

// Differences between an old and a new field value, as segments
// [{type: "same" | "removed" | "added", text, display, notes}].
// Identifiers are compared character by character, text word by word.
// Characters which look alike or are invisible are made visible in `display`
// and explained in `notes`.
SafeEdit.diff = {
  CHAR_FIELDS: ["DOI", "ISBN", "ISSN", "url", "callNumber"],

  // characters which are easily confused or invisible
  SPECIAL: {
    " ": ["⍽", "non-breaking space"],
    " ": ["⍽", "en space"],
    " ": ["⍽", "em space"],
    " ": ["⍽", "thin space"],
    "​": ["∅", "zero-width space"],
    "﻿": ["∅", "zero-width no-break space"],
    "\t": ["→", "tab"],
    "\n": ["↵", "line break"],
    "‐": ["‐", "hyphen (U+2010)"],
    "‑": ["‑", "non-breaking hyphen"],
    "‒": ["‒", "figure dash"],
    "–": ["–", "en dash"],
    "—": ["—", "em dash"],
    "−": ["−", "minus sign"],
    "‘": ["‘", "left single quote"],
    "’": ["’", "right single quote"],
    "“": ["“", "left double quote"],
    "”": ["”", "right double quote"],
  },

  // above this number of token comparisons, the values are shown as a whole
  MAX_CELLS: 4000000,

  tokenize(s, byChar) {
    if (byChar) {
      return Array.from(s);
    }
    return s.match(/\s+|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) || [];
  },

  // longest common subsequence of two token arrays → list of [type, token]
  _lcs(a, b) {
    var n = a.length;
    var m = b.length;
    if (n * m > this.MAX_CELLS) {
      return [
        ...a.map((t) => ["removed", t]),
        ...b.map((t) => ["added", t]),
      ];
    }
    // table of LCS lengths of suffixes
    var w = m + 1;
    var len = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        len[i * w + j] =
          a[i] === b[j]
            ? len[(i + 1) * w + j + 1] + 1
            : Math.max(len[(i + 1) * w + j], len[i * w + j + 1]);
      }
    }
    var out = [];
    var i = 0;
    var j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) {
        out.push(["same", a[i]]);
        i++;
        j++;
      } else if (len[(i + 1) * w + j] >= len[i * w + j + 1]) {
        out.push(["removed", a[i++]]);
      } else {
        out.push(["added", b[j++]]);
      }
    }
    while (i < n) out.push(["removed", a[i++]]);
    while (j < m) out.push(["added", b[j++]]);
    return out;
  },

  _display(text) {
    var out = "";
    for (let ch of text) {
      out += this.SPECIAL[ch] ? this.SPECIAL[ch][0] : ch;
    }
    // several spaces in a row are hard to see
    return out.replace(/ {2,}/g, (s) => "·".repeat(s.length));
  },

  _notes(text) {
    var notes = [];
    for (let ch of new Set(Array.from(text))) {
      if (this.SPECIAL[ch]) {
        notes.push(this.SPECIAL[ch][1]);
      }
    }
    if (/ {2,}/.test(text)) {
      notes.push("several spaces");
    }
    return notes;
  },

  compute(oldValue, newValue, field) {
    var a = String(oldValue == null ? "" : oldValue);
    var b = String(newValue == null ? "" : newValue);
    var byChar = this.CHAR_FIELDS.includes(field);
    var tokens = this._lcs(this.tokenize(a, byChar), this.tokenize(b, byChar));

    // merge neighbouring tokens of the same type
    var segments = [];
    for (let [type, text] of tokens) {
      var last = segments[segments.length - 1];
      if (last && last.type === type) {
        last.text += text;
      } else {
        segments.push({ type, text });
      }
    }
    for (let s of segments) {
      s.display = s.type === "same" ? s.text : this._display(s.text);
      s.notes = s.type === "same" ? [] : this._notes(s.text);
    }

    var notes = [];
    if (a !== b && a.toLowerCase() === b.toLowerCase()) {
      notes.push("only upper/lower case differs");
    }
    if (a !== b && a.trim() === b.trim()) {
      notes.push("only spaces at the start or end differ");
    }
    for (let s of segments) {
      for (let n of s.notes) {
        var note = (s.type === "removed" ? "removed: " : "added: ") + n;
        if (!notes.includes(note)) {
          notes.push(note);
        }
      }
    }
    return { mode: byChar ? "characters" : "words", segments, notes };
  },
};
