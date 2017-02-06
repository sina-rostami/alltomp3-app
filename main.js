const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const url = require('url');
const alltomp3 = require('alltomp3');
const nedb = require('nedb-promise');
var db = {
  config: nedb.datastore({ filename: path.join(app.getPath('userData'), 'config.db'), autoload: true })
};

// Database
// Initialization
db.config.findOne({ name: 'saving-path' }).then(conf => {
  console.log(conf);
  if (!conf) {
    return db.config.insert({ name: 'saving-path', value: app.getPath('music') });
  }
  return conf
});
// Messages so the renderer can query the database
ipcMain.on('db.findOne', (event, arg) => {
  console.log('[DB] findOne', arg);
  db[arg.db].findOne(arg.query).then(record => {
    console.log(record);
    event.returnValue = record;
  });
});
ipcMain.on('db.update', (event, arg) => {
  console.log('[DB] update', arg);
  db[arg.db].update(arg.query, arg.update).then(num => {
    console.log(num, 'records updated');
    event.returnValue = num;
  });
});


// alltomp3 library
function forwardEvents(emitter, sender, id) {
  let events = ['download', 'download-end', 'convert', 'error', 'infos', 'convert-end', 'end'];
  events.forEach(e => {
    emitter.on(e, forwardEvent(e, sender, id));
  });
  ipcMain.once('at3.abort.' + id, () => {
    emitter.emit('abort');
  });
}
function forwardEvent(name, sender, id) {
  return function(d) {
    console.log('[AT3] event', name, d);
    sender.send('at3.event', {
      id: id,
      name: name,
      data: d
    });
  }
}
ipcMain.on('at3.suggestions', (event, q) => {
  console.log('[AT3] suggestions', q);
  let type = alltomp3.typeOfQuery(q);
  if (type == 'text') {
    Promise.all([
      alltomp3.suggestedSongs(q, 5),
      alltomp3.suggestedAlbums(q, 5),
    ]).then(suggestions => {
      event.returnValue = {
        type: type,
        suggestions: {
          songs: suggestions[0],
          albums: suggestions[1]
        }
      };
    });
  } else {
    event.returnValue = {
      type: type,
      urlType: alltomp3.guessURLType(q)
    };
  }
});
/**
* q = {
* url: 'url to download',
* folder: 'folder where downloading the song',
* id: 'identifier choosen by the renderer to identify this download'
* }
*/
ipcMain.on('at3.downloadSingleURL', (event, q) => {
  console.log('[AT3] downloadSingleURL', q);
  let e = alltomp3.downloadAndTagSingleURL(q.url, q.folder);
  forwardEvents(e, event.sender, q.id);
});
/**
* q = {
* track: 'trackInfos',
* folder: 'folder where downloading the song',
* id: 'identifier choosen by the renderer to identify this download'
* }
*/
ipcMain.on('at3.downloadTrack', (event, q) => {
  console.log('[AT3] downloadTrack', q);
  let e = alltomp3.downloadTrack(q.track, q.folder);
  forwardEvents(e, event.sender, q.id);
});

var template = [{
    label: "AllToMP3",
    submenu: [
        { label: "About Application", selector: "orderFrontStandardAboutPanel:" },
        { type: "separator" },
        { label: "Quit", accelerator: "Command+Q", click: function() { app.quit(); }}
    ]}, {
    label: "Edit",
    submenu: [
        { label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
        { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
        { type: "separator" },
        { label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
        { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
        { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
        { label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:" }
    ]}
];

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

function createWindow () {
  // Create the browser window.
  win = new BrowserWindow({width: 400, height: 700})

  // and load the index.html of the app.
  // win.loadURL(url.format({
  //   pathname: path.join(__dirname, 'app/dist/index.html'),
  //   protocol: 'file:',
  //   slashes: true
  // }));
  win.loadURL('http://localhost:4200');

  // Open the DevTools.
  win.webContents.openDevTools();

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.