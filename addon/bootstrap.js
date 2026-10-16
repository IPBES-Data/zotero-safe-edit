/* global Zotero, Services, Cc, Ci */

// Zotero Safe Edit: local endpoints through which client applications can
// propose single-field edits to existing Zotero items. Every edit is checked,
// approved by the user in a dialog, logged, and can be undone.

var SafeEdit;
var chromeHandle;

// modules in load order; each is loaded into its own scope, so re-enabling the
// plugin does not redeclare anything
var MODULES = [
  "util",
  "clients",
  "diff",
  "log",
  "backup",
  "guards",
  "dialog",
  "edits",
  "api",
  "endpoints",
];

function install() {}

async function startup({ id, version, rootURI }) {
  await Zotero.initializationPromise;

  var aomStartup = Cc["@mozilla.org/addons/addon-manager-startup;1"].getService(
    Ci.amIAddonManagerStartup
  );
  chromeHandle = aomStartup.registerChrome(
    Services.io.newURI(rootURI + "manifest.json"),
    [["content", "safe-edit", rootURI + "content/"]]
  );

  // file APIs: global in privileged scopes, otherwise taken from the main window
  var win = Zotero.getMainWindow();
  var io = typeof IOUtils != "undefined" ? IOUtils : win.IOUtils;
  var paths = typeof PathUtils != "undefined" ? PathUtils : win.PathUtils;

  SafeEdit = { id, version, rootURI };
  for (let name of MODULES) {
    Services.scriptloader.loadSubScript(rootURI + "src/" + name + ".js", {
      Zotero,
      SafeEdit,
      Services,
      Cc,
      Ci,
      IOUtils: io,
      PathUtils: paths,
    });
  }
  // for the settings pane and other plugins (SafeEdit.api)
  Zotero.SafeEdit = SafeEdit;

  SafeEdit.endpoints.register();

  await Zotero.PreferencePanes.register({
    pluginID: id,
    src: rootURI + "content/prefs.xhtml",
    scripts: [rootURI + "content/prefs-pane.js"],
    stylesheets: [rootURI + "content/safe-edit.css"],
    label: "Safe Edit",
  });

  Zotero.debug("Safe Edit " + version + " started");
}

function shutdown() {
  if (SafeEdit && SafeEdit.endpoints) {
    SafeEdit.endpoints.unregister();
  }
  delete Zotero.SafeEdit;
  SafeEdit = undefined;
  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
}

function uninstall() {}
