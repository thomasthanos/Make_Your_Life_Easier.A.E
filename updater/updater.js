const { autoUpdater } = require("electron-updater");
const { dialog } = require("electron");

/**
 * Encapsulates logic for checking, downloading and installing updates.  This
 * class can be instantiated with a reference to the main application
 * window.  It sends status messages back to the renderer via the
 * main window’s webContents when updates are detected, downloaded or
 * installed.  The autoUpdater is configured to not download or install
 * automatically by default — this class coordinates user prompts and
 * silent installation as appropriate.
 */
class AppUpdater {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.setupAutoUpdater();
  }

  setupAutoUpdater() {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("checking-for-update", () => {
      this.sendStatusToWindow("Checking for update...");
    });

    autoUpdater.on("update-available", (info) => {
      this.sendStatusToWindow("Update available.");

      // Ask user if they want to download the update
      dialog
        .showMessageBox(this.mainWindow, {
          type: "info",
          title: "Update Available",
          message: `A new version ${info.version} is available. Do you want to download it now?`,
          buttons: ["Download", "Later"],
        })
        .then((result) => {
          if (result.response === 0) {
            autoUpdater.downloadUpdate();
          }
        });
    });

    autoUpdater.on("update-not-available", (info) => {
      this.sendStatusToWindow("Update not available.");
    });

    autoUpdater.on("error", (err) => {
      this.sendStatusToWindow("Error in auto-updater: " + err);
    });

    autoUpdater.on("download-progress", (progressObj) => {
      let log_message = "Download speed: " + progressObj.bytesPerSecond;
      log_message =
        log_message + " - Downloaded " + Math.round(progressObj.percent) + "%";
      log_message =
        log_message +
        " (" +
        progressObj.transferred +
        "/" +
        progressObj.total +
        ")";
      this.sendStatusToWindow(log_message);
    });

    autoUpdater.on("update-downloaded", (info) => {
      // When the update has been downloaded, install it silently and restart.
      // We still notify the user via the status channel, but we avoid showing
      // the NSIS wizard during updates.
      this.sendStatusToWindow(
        "Update downloaded; the application will now restart to install the update."
      );

      // Run the NSIS installer in silent mode and force the app to run again
      // after the update completes. This ensures that updates run quietly
      // without displaying the installer UI, while the initial installation
      // remains interactive.
      autoUpdater.quitAndInstall(true, true);
    });
  }

  sendStatusToWindow(text) {
    console.log("Updater:", text);
    if (this.mainWindow && this.mainWindow.webContents) {
      this.mainWindow.webContents.send("updater-message", text);
    }
  }

  checkForUpdates() {
    autoUpdater.checkForUpdates();
  }
}

module.exports = AppUpdater;