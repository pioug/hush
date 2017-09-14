import fs from 'fs';
import glob from 'glob';
import path from 'path';
import { ipcRenderer, remote } from 'electron';

import { Component, h, render } from 'preact';

class Search extends Component {
  handleKeyup = e => {
    this.props.keyup(e.target.value);
  }
  render() {
    return <input id="search" type="search" onkeyup={this.handleKeyup}/>;
  }
}

class Player extends Component {
  moveProgressbar = e => {
    const deleter = () => {
      window.removeEventListener('mousemove', setter);
      window.removeEventListener('mouseup', deleter);
    };

    const setter = e => {
      this.props.setCurrentTime(e.pageX / window.innerWidth);
    };

    setter(e);
    window.addEventListener('mousemove', setter);
    window.addEventListener('mouseup', deleter);
  }
  render({ playing, currentTime = 0, duration = 0 }) {
    const style = {
      width: currentTime / duration * 100 + '%'
    };

    document.title = playing.artist && playing.title ?
      `${playing.artist} - ${playing.title}` :
      'hush';

    return (
      <footer>
        <div class="player-progress" onmousedown={this.moveProgressbar}>
          <div class="player-progress-bar" style={style}></div>
        </div>
        <div class="player-infos">
          <div>{playing.artist} - {playing.title}</div>
          <div>{displayDuration(currentTime)} / {displayDuration(duration)}</div>
        </div>
      </footer>
    );
  }
}

class SongItem extends Component {
  handleMousedown = () => {
    this.props.mousedown(this.props.song);
  }
  handleDblclick = () => {
    this.props.dblclick(this.props.song);
  }
  render({ playing, song, selected }) {
    const style = {
      'background-color': song.src === selected.src ? '#292b3d' : null,
      color: song.src === playing.src ?
        '#ff0066' :
        'inherit',
    };

    return (
      <article
        onmousedown={this.handleMousedown}
        ondblclick={this.handleDblclick}
        style={style}>
        <span>{song.artist}</span>
        <span>{song.title}</span>
        <span>{song.album}</span>
      </article>
    );
  }
}

class Sonogram extends Component {
  state = (() => {
    const mainState = JSON.parse(JSON.stringify(remote.getGlobal('state')));
    const { playing = { src: '' }, playlist = [] } = mainState;
    return {
      playing: playlist.find(song => playing.src.includes(song.src)),
      playlist,
      library: playlist
    };
  })()
  mousedownSongItem = x => {
    this.setState({ selected: x })
  }
  play = ({ ...x }) => {
    ipcRenderer.send('Player:command', {
      command: 'play',
      ...x
    });
  }
  setCurrentTime = (ratio) => {
    ipcRenderer.send('Player:command', {
      command: 'currentTime',
      currentTime: this.state.duration * ratio
    });
  }
  searchSong = search => {
    if (search) {
      const playlist = this.state.library.filter(({ title }) => title.toLowerCase().includes(search.toLowerCase()));
      this.setState({ playlist });
    } else {
      this.setState({ playlist: this.state.library });
    }
  }
  componentDidMount() {
    ipcRenderer.on('Player:timeupdate', (event, { currentTime = 0, duration = 0 }) => {
      this.setState({ currentTime, duration });
    });
    ipcRenderer.on('Main:playlistupdate', (event, { playlist = [] }) => {
      playlist = JSON.parse(JSON.stringify(playlist));
      this.setState({ playlist, library: playlist });
    });

    ipcRenderer.on('Player:play', (event, { src = '' }) => {
      const playing = this.state.playlist.find(song => src.includes(song.src));
      this.setState({ playing });
    });

    window.addEventListener('keydown', event => {
      const SONG_ITEM_HEIGHT = 19;
      switch (event.key) {
        case 'ArrowUp': {
          const index = this.state.playlist.indexOf(this.state.selected) - 1;
          const selected = this.state.playlist[index];
          this.setState({ selected });

          const elList = document.getElementById('list');
          if (index * SONG_ITEM_HEIGHT < elList.scrollTop) {
            elList.scrollTop = index * SONG_ITEM_HEIGHT;
          }

          event.preventDefault();
          break;
        }
        case 'ArrowDown': {
          const index = this.state.playlist.indexOf(this.state.selected) + 1;
          const selected = this.state.playlist[index];
          this.setState({ selected });

          const elList = document.getElementById('list');
          if ((index + 1) * SONG_ITEM_HEIGHT > elList.scrollTop + elList.clientHeight) {
            elList.scrollTop = (index + 1) * SONG_ITEM_HEIGHT - elList.clientHeight;
          }

          event.preventDefault();
          break;
        }
        case 'Enter': {
          this.play(this.state.selected);
          event.preventDefault();
          break;
        }
        case 'f': {
          if (event.metaKey) {
            const elSearch = document.getElementById('search');
            elSearch.focus();
            event.preventDefault();
          }
        }
      }
    });
  }
  render(children, { playlist = [], selected = {}, playing = {}, currentTime = 0, duration = 0 }) {

    const list = playlist.map(x =>
      <SongItem
        mousedown={this.mousedownSongItem}
        dblclick={this.play}
        song={x}
        playing={playing}
        selected={selected}/>
    );

    return (
      <main>
        <Search keyup={this.searchSong}/>
        <section id="list">{list}</section>
        <Player
          setCurrentTime={this.setCurrentTime}
          playing={playing}
          currentTime={currentTime}
          duration={duration} />
      </main>
    );
  }
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

  const files = Array.from(event.dataTransfer.files)
    .reduce((res, x) => {
      const stats = fs.statSync(x.path);
      if (stats.isDirectory()) {
        return [...res, ...glob.sync(escapeSquareBrackets(x.path) + '/**/*.{mp3,m4a,flac,aac}').map(x => ({ src: x }))];
      } else {
        if (['.mp3', '.m4a', '.flac', '.aac'].includes(path.extname(x.path))) {
          return [...res, { src: x.path }];
        }

        return res;
      }
    }, []);

  ipcRenderer.send('Main:playlistupdate', { files });
});

function escapeSquareBrackets(str) {
  return str.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}
