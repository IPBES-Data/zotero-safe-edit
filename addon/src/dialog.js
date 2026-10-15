/* global Zotero, SafeEdit */

// Opens the approval dialog and resolves with
//   {cancelled: true} or {approved: [row indices], scrolled_to_end: true}
// meta.mode "lines": a batch of added lines, approved with a tick box
SafeEdit.dialog = {
  // progress window while writing many changes; never stops the writing
  progress(total) {
    var pw, line;
    try {
      pw = new Zotero.ProgressWindow({ closeOnClick: false });
      pw.changeHeadline("Safe Edit");
      line = new pw.ItemProgress(null, `Writing 0 of ${total} changes …`);
      pw.show();
    } catch (e) {
      Zotero.logError(e);
    }
    return {
      update(n) {
        if (!line || (n % 50 && n !== total)) return;
        try {
          line.setText(`Writing ${n} of ${total} changes …`);
          line.setProgress((100 * n) / total);
        } catch (e) {}
      },
      close(n) {
        try {
          line.setText(`${n} changes written`);
          line.setProgress(100);
          pw.startCloseTimer(4000);
        } catch (e) {}
      },
    };
  },

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
