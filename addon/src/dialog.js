/* global Zotero, SafeEdit */

// Opens the approval dialog and resolves with
//   {cancelled: true} or {approved: [row indices], scrolled_to_end: true}
SafeEdit.dialog = {
  open(rows, meta) {
    return new Promise((resolve, reject) => {
      var win = Zotero.getMainWindow();
      if (!win) {
        reject(new Error("The Zotero window is not open"));
        return;
      }
      var io = {
        rows,
        meta,
        done: false,
        finish(result) {
          if (!io.done) {
            io.done = true;
            resolve(result);
          }
        },
      };
      var dlg = win.openDialog(
        "chrome://safe-edit/content/approve.xhtml",
        "",
        "chrome,dialog,centerscreen,resizable,width=1000,height=750",
        io
      );
      dlg.focus();
    });
  },
};
