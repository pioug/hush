import fs from 'fs';
import glob from 'glob';
import { ipcRenderer, remote } from 'electron';

import { Component, h, render } from 'preact';

class Sonogram extends Component {
  componentDidMount() {
    // ipcRenderer.on('Player:timeupdate', (event, { currentTime = 0, duration = 0 }) => {
    //   this.setState({ currentTime, duration });
    // });
    ipcRenderer.on('Main:playlistupdate', (event, { playlist = [] }) => {
      playlist = JSON.parse(JSON.stringify(playlist));
      this.setState({ playlist });
    });

    const state = JSON.parse(JSON.stringify(remote.getGlobal('state')));
    this.setState(state);
  }
  select(x) {
    this.setState({ selected: x });
  }
  render(children, { playlist = [], selected = {} }) {
    const list = playlist.map(x =>
      <SongItem
        click={() => this.select(x)}
        dblclick={() => play(x)}
        song={x}
        selected={selected}/>
    );

    return (
      <div>
        {list}
        {/* {currentTime}/{duration} */}
      </div>
    );
  }
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

function SongItem({ song, selected, click, dblclick }) {
  const style = song.src === selected.src ? {
    'background-color': '#E1C401',
    color: '#000'
  } : {};

  return (
    <article
      onclick={click}
      ondblclick={dblclick}
      style={style}>
      <span>{song.artist}</span>
      <span>{song.title}</span>
    </article>
  );
}

function play({ ...x }) {
  ipcRenderer.send('Player:command', {
    command: 'play',
    ...x
  });
}
