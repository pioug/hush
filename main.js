import _ from "lodash";
import jsmediatags from "jsmediatags";
import path from "path";
import RxDB from "rxdb";
import url from "url";
import webSqlAdapter from "pouchdb-adapter-node-websql";
import { app, BrowserWindow, globalShortcut, ipcMain, Menu } from "electron";

RxDB.plugin(webSqlAdapter);

const openDatabase = _.once(openDatabase_);

let guiBounds = {};
let gui;
let player;

function openDatabase_() {
  return RxDB.create({
    name: path.join(app.getPath("userData"), "database"),
    adapter: "websql",
    multiInstance: true
  });
}

async function openCollection({
  database_ = openDatabase(),
  name = "library"
} = {}) {
  const database = await database_;
  const schema = {
    library: {
      version: 0,
      type: "object",
      properties: {
        album: { type: "string" },
        artist: { type: "string" },
        src: { primary: true, type: "string" },
        title: { type: "string" }
      }
    }
  }[name];

  return database.collection({
    name: name,
    schema
  });
}

async function getLibrary() {
  const collection = await openCollection();
  return collection.find().exec();
}

getLibrary().then(library => {
  global.state = {
    playlist: library,
    playback: {
      random: true
    }
  };
});

// https://developers.google.com/web/updates/2017/09/autoplay-policy-changes
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

app.on("ready", () => {
  createGui();
  createPlayer();
  bindShorcuts();
  createMenu();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (gui === null) {
    createGui();
  }
});

ipcMain.on("Player:timeupdate", (event, params) => {
  if (gui) {
    gui.webContents.send("Player:timeupdate", params);
  }
});

ipcMain.on("Player:play", (event, params) => {
  if (gui) {
    gui.webContents.send("Player:play", params);
  }

  global.state.playing = params;
});

ipcMain.on("Player:command", (event, params) => {
  if (player) {
    player.webContents.send("Player:command", params);
  }
});

ipcMain.on("Main:playlistupdate", (event, { files = [] }) => {
  let i = 0;
  let songs = [];

  const promise = files.reduce((acc, file) => {
    return acc.then(
      () =>
        new Promise((res, rej) => {
          jsmediatags.read(file.src, {
            onSuccess: e => {
              const { artist, title, album } = e.tags;
              console.log(i++, files.length, file.src);
              songs.push({
                album,
                artist,
                title,

                // Encode question mark in filename/filepath
                src: file.src
                  .split(path.sep)
                  .map(encodeURIComponent)
                  .join(path.sep)
              });
              res(songs);
            },
            onError: rej
          });
        })
    );
  }, Promise.resolve(songs));

  promise.then(() => {
    global.state.playlist = songs;

    openDatabase().then(async db => {
      await db.library.remove();
      await openCollection();
      songs.map(song => db.library.insert(song));
    });

    if (gui) {
      gui.webContents.send("Main:playlistupdate", global.state);
    }

    if (player) {
      player.webContents.send("Main:playlistupdate", global.state);
    }
  });
});

function createGui() {
  gui = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true
    },
    width: 800,
    height: 600,
    ...guiBounds
  });

  gui.loadURL(
    url.format({
      pathname: path.join(__dirname, "gui.html"),
      protocol: "file:",
      slashes: true,
      icon: path.join(__dirname, "icon.png")
    })
  );

  if (process.env.DEBUG) {
    gui.webContents.openDevTools();
  }

  gui.on("close", () => {
    guiBounds = gui.getBounds();
  });

  gui.on("closed", () => {
    gui = null;
  });
}

function createPlayer() {
  player = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true
    },
    show: false
  });

  player.loadURL(
    url.format({
      pathname: path.join(__dirname, "player.html"),
      protocol: "file:",
      slashes: true
    })
  );

  if (process.env.DEBUG) {
    player.webContents.openDevTools();
  }

  player.on("closed", () => {
    player = null;
  });
}

function bindShorcuts() {
  globalShortcut.register("MediaPreviousTrack", () => {
    player.webContents.send("Player:command", {
      command: "previous"
    });
  });

  globalShortcut.register("MediaPlayPause", () => {
    player.webContents.send("Player:command", {
      command: "pause"
    });
  });

  globalShortcut.register("MediaNextTrack", () => {
    player.webContents.send("Player:command", {
      command: "next"
    });
  });
}

function createMenu() {
  const template = [
    {
      label: app.getName(),
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services", submenu: [] },
        { type: "separator" },
        { role: "hide" },
        { role: "hideothers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
        { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
        { type: "separator" },
        { label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
        { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
        { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
        {
          label: "Select All",
          accelerator: "CmdOrCtrl+A",
          selector: "selectAll:"
        }
      ]
    },
    {
      label: "Playback",
      submenu: [
        {
          label: "Random",
          type: "checkbox",
          checked: true,
          click() {
            global.state.playback.random = !global.state.playback.random;
            player.webContents.send(
              "Main:playbackupdate",
              global.state.playback
            );
          }
        }
      ]
    },
    {
      role: "window",
      submenu: [{ role: "minimize" }, { role: "close" }]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
