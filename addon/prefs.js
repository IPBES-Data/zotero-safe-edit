// Default preferences. Changed by the user in the Safe Edit settings pane,
// never by client applications.
pref("extensions.safe-edit.maxBackupAgeMinutes", 60);
pref("extensions.safe-edit.maxBatchSize", 25);
// large batches of changes which only add one line at the end of the Extra
// field (or remove it again, for an undo): off unless enabled in the settings
pref("extensions.safe-edit.lineBatches", false);
pref("extensions.safe-edit.maxLineBatchSize", 10000);
// comma separated Zotero field names which may be edited
pref("extensions.safe-edit.allowedFields", "DOI");
// registered client applications (JSON, tokens stored as SHA-256 hashes)
pref("extensions.safe-edit.clients", "[]");
