// Approval dialog. Receives {rows, meta, finish} as window.arguments[0].
// All item data is inserted as text, never as HTML.

var io = window.arguments[0];
var reachedEnd = false;
// batch of added (or removed) lines: compact list, approved with a tick box
var lines = io.meta.mode === "lines";

function el(tag, attrs, ...children) {
  var e = document.createElement(tag);
  for (let [k, v] of Object.entries(attrs || {})) {
    if (k === "class") e.className = v;
    else e.setAttribute(k, v);
  }
  for (let c of children) {
    if (c === null || c === undefined) continue;
    e.append(typeof c == "string" ? document.createTextNode(c) : c);
  }
  return e;
}

// one line of the diff: the old value (same + removed) or the new one (same + added)
function diffLine(segments, side) {
  var line = el("div", { class: "value " + side });
  var show = side === "before" ? "removed" : "added";
  var any = false;
  for (let s of segments) {
    if (s.type === "same") {
      line.append(el("span", {}, s.display));
      any = true;
    } else if (s.type === show) {
      line.append(el("span", { class: s.type }, s.display));
      any = true;
    }
  }
  if (!any) line.append(el("span", { class: "empty" }, "(empty)"));
  return line;
}

function row(r) {
  var box = el("input", { type: "checkbox", "data-index": String(r.index) });
  box.checked = r.ok;
  box.disabled = !r.ok;
  box.addEventListener("change", update);

  var head = el(
    "div",
    { class: "row-head" },
    box,
    el("span", { class: "title" }, r.title || "(item not found)"),
    el("span", { class: "meta" }, `${r.group} · ${r.item_type} · key ${r.item_key} · field ${r.field}`)
  );
  var body = el("div", { class: "row-body" });
  if (r.reason_for_change) {
    body.append(el("div", { class: "why" }, "Why: " + r.reason_for_change));
  }
  if (r.diff) {
    body.append(
      el("div", { class: "label" }, "Before"),
      diffLine(r.diff.segments, "before"),
      el("div", { class: "label" }, "After"),
      diffLine(r.diff.segments, "after")
    );
    if (r.diff.notes.length) {
      body.append(el("div", { class: "notes" }, "Note: " + r.diff.notes.join("; ")));
    }
  }
  if (!r.ok) {
    body.append(el("div", { class: "problem" }, "Cannot be applied: " + r.problem));
  }
  return el("section", { class: r.ok ? "row" : "row invalid" }, head, body);
}

// the line a change adds ("+") or removes ("−")
function lineOf(r) {
  var added = r.new.length > r.old.length;
  var long = added ? r.new : r.old;
  var short = added ? r.old : r.new;
  return { sign: added ? "+" : "−", text: long.slice(short === "" ? 0 : short.length + 1) };
}

function lineRow(r) {
  var box = el("input", { type: "checkbox", "data-index": String(r.index) });
  box.checked = r.ok;
  box.disabled = !r.ok;
  box.addEventListener("change", update);
  var l = lineOf(r);
  return el(
    "div",
    { class: r.ok ? "line-row" : "line-row invalid" },
    box,
    el("span", { class: "title" }, r.title || "(item not found)"),
    el("span", { class: l.sign === "+" ? "added" : "removed" }, `${l.sign} ${r.field}: ${l.text}`),
    r.ok ? null : el("span", { class: "problem" }, " — cannot be applied: " + r.problem)
  );
}

// kinds of lines, numbers replaced, e.g. "OpenAlex: W…" (5132)
function lineSummary() {
  var kinds = new Map();
  for (let r of io.rows) {
    var l = lineOf(r);
    var k = `${l.sign} ${r.field}: ${l.text.replace(/[0-9]+/g, "…")}`;
    kinds.set(k, (kinds.get(k) || 0) + 1);
  }
  return Array.from(kinds, ([k, n]) => `${k} (${n})`).join(" · ");
}

function boxes() {
  return Array.from(document.querySelectorAll("#rows input[type=checkbox]"));
}

function checkScroll() {
  var list = document.getElementById("rows");
  if (list.scrollHeight - list.scrollTop - list.clientHeight <= 2) {
    reachedEnd = true;
  }
  update();
}

function update() {
  var valid = boxes().filter((b) => !b.disabled);
  var selected = valid.filter((b) => b.checked);
  document.getElementById("counter").textContent =
    `${io.rows.length} changes · ${valid.length - selected.length} deselected · ` +
    `${io.rows.length - valid.length} cannot be applied · ${selected.length} will be saved`;
  if (lines) {
    document.getElementById("scroll-hint").hidden = true;
    document.getElementById("approve").disabled =
      !document.getElementById("confirm").checked || !selected.length;
    return;
  }
  document.getElementById("scroll-hint").hidden = reachedEnd;
  document.getElementById("approve").disabled = !reachedEnd || !selected.length;
}

window.addEventListener("load", () => {
  document.getElementById("meta").textContent =
    `Requested by: ${io.meta.client} · Action: ${io.meta.action} · Batch ${io.meta.batch_id}`;
  var list = document.getElementById("rows");
  if (lines) {
    document.getElementById("heading").textContent = "Approve adding lines";
    document.getElementById("hint").textContent =
      `Each of these ${io.rows.length} changes only adds one line at the end of a field ` +
      `(or removes it again). Lines: ${lineSummary()}. Check the list, untick changes you ` +
      `do not want, then tick "I have checked the list" to approve.`;
    document.getElementById("confirm-box").hidden = false;
    document.getElementById("confirm").addEventListener("change", update);
  }
  for (let r of io.rows) list.append(lines ? lineRow(r) : row(r));
  list.addEventListener("scroll", checkScroll);
  window.addEventListener("resize", checkScroll);

  document.getElementById("approve").addEventListener("click", () => {
    io.finish({
      approved: boxes()
        .filter((b) => b.checked && !b.disabled)
        .map((b) => Number(b.dataset.index)),
      scrolled_to_end: reachedEnd,
    });
    window.close();
  });
  document.getElementById("cancel").addEventListener("click", () => {
    io.finish({ cancelled: true });
    window.close();
  });
  checkScroll();
});

// closing the window counts as cancel
window.addEventListener("unload", () => io.finish({ cancelled: true }));
