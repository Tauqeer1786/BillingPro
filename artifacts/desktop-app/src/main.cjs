const { app, BrowserWindow, Menu, dialog, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

if (process.platform === "linux") {
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-gpu");
}

let apiProcess = null;
let mainWindow = null;
let isQuitting = false;

function getResourcePath(...parts) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...parts);
  }

  return path.join(__dirname, "..", "..", ...parts);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function findOpenPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function waitForServer(url, timeoutMs = 15000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });

      req.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }

        setTimeout(check, 250);
      });

      req.setTimeout(1000, () => {
        req.destroy();
      });
    };

    check();
  });
}

async function startApiServer() {
  const port = await findOpenPort();
  const userData = app.getPath("userData");
  const dataDir = path.join(userData, "data");
  const backupsDir = path.join(userData, "backups");
  ensureDir(dataDir);
  ensureDir(backupsDir);

  const apiEntry = getResourcePath("api-server", "index.mjs");
  const staticDir = getResourcePath("billing-app");

  apiProcess = spawn(process.execPath, [apiEntry], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      STATIC_DIR: staticDir,
      DB_PATH: path.join(dataDir, "billing.db"),
      BACKUP_DIR: backupsDir,
      ELECTRON_RUN_AS_NODE: "1",
    },
    stdio: "pipe",
  });

  apiProcess.stdout.on("data", (chunk) => {
    console.log(`[api] ${chunk}`);
  });

  apiProcess.stderr.on("data", (chunk) => {
    console.error(`[api] ${chunk}`);
  });

  apiProcess.on("exit", (code, signal) => {
    apiProcess = null;
    if (code !== 0 && signal !== "SIGTERM") {
      console.error(`API server exited with code ${code ?? "null"} and signal ${signal ?? "null"}`);
    }
  });

  const appUrl = `http://127.0.0.1:${port}`;
  await waitForServer(`${appUrl}/api/healthz`);
  return appUrl;
}

async function createWindow(appUrl) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: "Local Ledger Pro",
    backgroundColor: "#ffffff",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.removeMenu();

  mainWindow.on("close", () => {
    isQuitting = true;
    stopApiServer();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url === "about:blank" || url.startsWith(appUrl)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 900,
          height: 700,
          title: "Print",
          backgroundColor: "#ffffff",
          autoHideMenuBar: true,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        },
      };
    }

    shell.openExternal(url);
    return { action: "deny" };
  });

  await mainWindow.loadURL(appUrl);
}

function stopApiServer() {
  if (!apiProcess || apiProcess.killed) return;
  const child = apiProcess;
  child.kill("SIGTERM");
  setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
    }
  }, 1500).unref();
  apiProcess = null;
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);

  try {
    const appUrl = await startApiServer();
    await createWindow(appUrl);
  } catch (error) {
    console.error(error);
    dialog.showErrorBox(
      "Local Ledger Pro failed to start",
      error instanceof Error ? error.message : String(error),
    );
    app.quit();
  }

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const appUrl = await startApiServer();
      await createWindow(appUrl);
    }
  });
});

app.on("before-quit", () => {
  isQuitting = true;
  stopApiServer();
});

app.on("will-quit", stopApiServer);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    isQuitting = true;
    stopApiServer();
    app.quit();
  }
});
