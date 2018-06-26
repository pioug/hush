import { ipcRenderer, remote } from "electron";

const audio = new Audio();
const audioCtx = new AudioContext();
const source = audioCtx.createMediaElementSource(audio);
source.connect(audioCtx.destination);

audio.volume = .5;

audio.ontimeupdate = function() {
  ipcRenderer.send("Player:timeupdate", {
    currentTime: this.currentTime,
    duration: this.duration
  });
};

audio.onplay = function() {
  ipcRenderer.send("Player:play", {
    src: this.src
  });
};

audio.onended = playNext;

ipcRenderer.on(
  "Main:playlistupdate",
  (event, { playlist: newPlaylist = [] }) => {
    playlist = newPlaylist;
  }
);

ipcRenderer.on("Main:playbackupdate", (event, params) => {
  Object.assign(playback, ...params);
});

let playlist = remote.getGlobal("state").playlist;
let playback = remote.getGlobal("state").playback;
let playing;

ipcRenderer.on("Player:command", function(
  event,
  { command, src = playlist[0].src, currentTime = 0 }
) {
  switch (command) {
    case "next": {
      playNext();
      break;
    }
    case "previous": {
      const previous = playback.random
        ? playlist[Math.floor(Math.random() * playlist.length)]
        : playlist[playlist.findIndex(x => audio.src.includes(x.src)) - 1] ||
          playlist[playlist.length - 1];
      audio.pause();
      audio.currentTime = 0;
      audio.src = previous.src;
      playing = Promise.resolve(playing)
        .then(() => audio.play())
        .catch(() => Promise.resolve());
      break;
    }
    case "play":
      audio.pause();
      audio.src = src;
      audio.currentTime = 0;
      playing = Promise.resolve()
        .then(() => audio.play())
        .catch(() => Promise.resolve());
      break;
    case "pause":
      if (!audio.src) {
        audio.src = src;
      }

      playing = Promise.resolve(playing)
        .then(() => (audio.paused ? audio.play() : audio.pause()))
        .catch(() => Promise.resolve());
      break;
    case "currentTime":
      audio.currentTime = currentTime;
      break;
  }
});

function playNext() {
  const next = playback.random
    ? playlist[Math.floor(Math.random() * playlist.length)]
    : playlist[playlist.findIndex(x => audio.src.includes(x.src)) + 1] ||
      playlist[0];
  audio.pause();
  audio.currentTime = 0;
  audio.src = next.src;
  playing = Promise.resolve(playing)
    .then(() => audio.play())
    .catch(() => Promise.resolve());
}
