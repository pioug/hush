import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain
} from 'electron';
import path from 'path';
import url from 'url';
import jsmediatags from 'jsmediatags';

let gui;
let player;

global.state = {
  playlist: []
};

app.on('ready', () => {
  createGui();
  createPlayer();
  bindShorcuts();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
});

app.on('activate', () => {
  if (gui === null) {
    createGui()
  }
});

ipcMain.on('Player:timeupdate', (event, params) => {
  if (gui) {
    gui.webContents.send('Player:timeupdate', params)
  }
});

ipcMain.on('Player:command', (event, params) => {
  if (player) {
    player.webContents.send('Player:command', params)
  }
});

ipcMain.on('Main:playlistupdate', (event, { files = [] }) => {
  const promises = files.map(file => {
    return new Promise((res, rej) => {
      jsmediatags.read(file.src, {
        onSuccess: e => {
          const { artist, title, album } = e.tags;
          res({
            album,
            artist,
            title,
            src: file.src
          });
        },
        onError: rej
      })
    });
  });

  Promise.all(promises)
    .then(songs => {
      global.state.playlist = songs;

      if (gui) {
        gui.webContents.send('Main:playlistupdate', global.state)
      }

      if (player) {
        player.webContents.send('Main:playlistupdate', global.state)
      }
    });
});

function createGui() {
  gui = new BrowserWindow({ width: 800, height: 600 });

  gui.loadURL(url.format({
    pathname: path.join(__dirname, 'gui.html'),
    protocol: 'file:',
    slashes: true,
    icon: path.join(__dirname, 'icon.png')
  }));

  gui.webContents.openDevTools();

  gui.on('closed', () => gui = null);
}

function createPlayer() {
  player = new BrowserWindow({ width: 800, height: 600, show: false });

  player.loadURL(url.format({
    pathname: path.join(__dirname, 'player.html'),
    protocol: 'file:',
    slashes: true
  }));

  // player.webContents.openDevTools();

  player.on('closed', () => gui = null);
}

function bindShorcuts() {
  globalShortcut.register('MediaPreviousTrack', () => {
    player.webContents.send('Player:command', {
      command: 'previous'
    });
  });

  globalShortcut.register('MediaPlayPause', () => {
    player.webContents.send('Player:command', {
      command: 'pause'
    });
  });

  globalShortcut.register('MediaNextTrack', () => {
    player.webContents.send('Player:command', {
      command: 'next'
    })
  });
}
