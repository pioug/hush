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

ipcRenderer.on('Main:playlistupdate', (event, { playlist: newPlaylist = [] }) => {
  playlist = newPlaylist
});

let playlist = remote.getGlobal('state').playlist;
let playing;

ipcRenderer.on('Player:command', function(event, { command, src = playlist[0].src }) {
  switch (command) {
    case 'next': {
      const next = playlist[playlist.findIndex(x => decodeURI(audio.src).includes(x.src)) + 1] || playlist[0];
      audio.currentTime = 0;
      audio.src = next.src;
      playing = Promise.resolve(playing)
        .then(() => {
          playing = audio.play();
          return;
        });
      break;
    }
    case 'previous': {
      const previous = playlist[playlist.findIndex(x => decodeURI(audio.src).includes(x.src)) - 1] || playlist[playlist.length - 1];
      audio.currentTime = 0;
      audio.src = previous.src;
      playing = Promise.resolve(playing)
        .then(() => {
          playing = audio.play();
          return;
        });
      break;
    }
    case 'play':
      audio.src = src;
      audio.currentTime = 0;
      playing = Promise.resolve(playing)
        .then(() => {
          playing = audio.play();
          return;
        });
      break;
    case 'pause':
      if (!audio.src) {
        audio.src = src;
      }

      playing = Promise.resolve(playing)
        .then(() => {
          playing = audio.paused ? audio.play() : audio.pause();
          return playing;
        });
      break;
  }
});
