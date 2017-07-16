import { ipcRenderer, remote } from 'electron';

const audio = new Audio();
const audioCtx = new AudioContext();
const source = audioCtx.createMediaElementSource(audio);
source.connect(audioCtx.destination);

audio.ontimeupdate = function() {
  ipcRenderer.send('Player:timeupdate', {
    currentTime: this.currentTime,
    duration: this.duration
  });
};

audio.onended = playNext;

ipcRenderer.on('Main:playlistupdate', (event, { playlist: newPlaylist = [] }) => {
  playlist = newPlaylist
});

let playlist = remote.getGlobal('state').playlist;
let playing;

ipcRenderer.on('Player:command', function(event, { command, src = playlist[0].src }) {
  switch (command) {
    case 'next': {
      playNext();
      break;
    }
    case 'previous': {
      const previous = playlist[playlist.findIndex(x => audio.src.includes(x.src)) - 1] || playlist[playlist.length - 1];
      audio.pause();
      audio.currentTime = 0;
      audio.src = previous.src;
      playing = Promise.resolve(playing)
        .then(() => audio.play())
        .catch(() => Promise.resolve());
      break;
    }
    case 'play':
      audio.pause();
      audio.src = src;
      audio.currentTime = 0;
      playing = Promise.resolve()
        .then(() => audio.play())
        .catch(() => Promise.resolve());
      break;
    case 'pause':
      if (!audio.src) {
        audio.src = src;
      }

      playing = Promise.resolve(playing)
        .then(() => audio.paused ? audio.play() : audio.pause())
        .catch(() => Promise.resolve());
      break;
  }
});

function playNext() {
  const next = playlist[playlist.findIndex(x => audio.src.includes(x.src)) + 1] || playlist[0];
  audio.pause();
  audio.currentTime = 0;
  audio.src = next.src;
  playing = Promise.resolve(playing)
    .then(() => audio.play())
    .catch(() => Promise.resolve());
}
