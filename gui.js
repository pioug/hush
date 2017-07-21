import fs from 'fs';
import glob from 'glob';
import { ipcRenderer, remote } from 'electron';

import { Component, h, render } from 'preact';

class Sonogram extends Component {
  componentDidMount() {
    ipcRenderer.on('Player:timeupdate', (event, { currentTime = 0, duration = 0 }) => {
      this.setState({ currentTime, duration });
    });
    ipcRenderer.on('Main:playlistupdate', (event, { playlist = [] }) => {
      playlist = JSON.parse(JSON.stringify(playlist));
      this.setState({ playlist });
    });

    ipcRenderer.on('Player:play', (event, { src = '' }) => {
      const playing = this.state.playlist.find(song => src.includes(song.src));
      this.setState({ playing });
    });

    const state = JSON.parse(JSON.stringify(remote.getGlobal('state')));
    this.setState(state);
  }
  select(x) {
    this.setState({ selected: x });
  }
  render(children, { playlist = [], selected = {}, playing = {}, currentTime = 0, duration = 0 }) {
    const list = playlist.map(x =>
      <SongItem
        click={() => this.select(x)}
        dblclick={() => play(x)}
        song={x}
        playing={playing}
        selected={selected}/>
    );

    return (
      <div>
        {list}
        <Player
          playing={playing}
          currentTime={currentTime}
          duration={duration} />
      </div>
    );
  }
}

function Player({ playing, currentTime, duration }) {
  console.log(playing);
  return (
    <div>
      <div>{playing.artist} - {playing.title} ({playing.album})</div>
      <div>{displayDuration(currentTime)}/{displayDuration(duration)}</div>
    </div>
  );
}

function displayDuration(inputSeconds) {
  var isPositive = inputSeconds >= 0,
    seconds,
    minutes,
    display;

  inputSeconds = Math.abs(inputSeconds);
  seconds = Math.floor(inputSeconds % 60);
  minutes = Math.floor(inputSeconds / 60);

  if (seconds === 60) {
    minutes++;
    seconds = 0;
  }

  display = `${minutes}:${to2(seconds)}`;
  display = isPositive ? display : `-${display}`;
  return display;
}

function to2(val) {
  return val < 10 ? `0${val}` : val;
}

render(<Sonogram />, document.body);

window.addEventListener('dragover', event => {
  event.preventDefault();
  event.stopPropagation();
});


window.addEventListener('drop', event => {
  event.preventDefault();
  event.stopPropagation();

  const files = Array.from(event.dataTransfer.files).reduce((res, x) => {
    const stats = fs.statSync(x.path);
    if (stats.isDirectory()) {
      return [...res, ...glob.sync(x.path + '/**/*.{mp3,m4a,flac,aac}').map(x => ({ src: x }))];
    } else {
      return [...res, { src: x.path }];
    }
  }, []);

  ipcRenderer.send('Main:playlistupdate', {
    files
  });
});

function SongItem({ playing, song, selected, click, dblclick }) {
  const style = {
    'background-color': song.src === selected.src ? '#292b3d' : null,
    color: song.src === playing.src ?
      '#ff0066' :
      'inherit',
  };

  return (
    <article
      onclick={click}
      ondblclick={dblclick}
      style={style}>
      <span>{song.artist}</span>
      <span>{song.title}</span>
      <span>{song.album}</span>
    </article>
  );
}

function play({ ...x }) {
  ipcRenderer.send('Player:command', {
    command: 'play',
    ...x
  });
}
