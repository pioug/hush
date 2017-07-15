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
      this.setState({ playlist });
    });

    this.setState(remote.getGlobal('state'));
  }
  render(children, { playlist = [], currentTime = 0, duration = 0 }) {
    const list = playlist.map(x => <div onclick={() => play(x)}>{x.artist} - {x.title}</div>);
    return <div>{list}{currentTime}/{duration}</div>;
  }
}

render(<Sonogram />, document.body);

function play({ ...x }) {
  ipcRenderer.send('Player:command', {
    command: 'play',
    ...x
  });
}

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
