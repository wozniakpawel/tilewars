const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const symbols = ['%', '^', '&', '*', '(', '#', '@', '/', '_'];
const colours = ['green', 'blue', 'red', 'yellow', 'orange'];
const uid = (Math.random() * 1000) | 0;

var mapSize = 9;
var playerNames = {};
var playerTiles = {};
var playerIndices = {};
var players = [];
var map = [
  [[0], [0], [0], [0], [0], [0], [0], [0], [0]],
  [[0], [0], [0], [0], [0], [0], [0], [0], [0]],
  [[0], [0], [0], [0], [0], [0], [0], [0], [0]],
  [[0], [0], [0], [0], [0], [0], [0], [0], [0]],
  [[0], [0], [0], [0], [0], [0], [0], [0], [0]],
  [[0], [0], [0], [0], [0], [0], [0], [0], [0]],
  [[0], [0], [0], [0], [0], [0], [0], [0], [0]],
  [[0], [0], [0], [0], [0], [0], [0], [0], [0]],
  [[0], [0], [0], [0], [0], [0], [0], [0], [0]],
 ];
var selection = 0;
var room;
var name;
var myID;
var myTiles = [];
var activePlayer;
// events triggered on window resize or orientation change
window.addEventListener('resize', resize, false);
window.addEventListener('orientationchange', resize, false);

/// socket.io communication
const socket = io.connect('http://tilewars.io/');

socket.on('reconnect', function () {
  console.log('you have been reconnected');
  console.log(myID);
  // where username is a global variable for the client
  socket.emit('user-reconnected', {previousID: myID});
});

socket.on('newGame', (data) => {
  room = data.newRoomID;
  myID = data.newPlayerID;
  playerNames[myID] = name;
  lobby();
});

socket.on('gameJoined', (data) => {
  myID = data.newPlayerID;
  playerNames = data.playerNames;
  lobby();
});

socket.on('playerJoined', (data) => {
  playerNames[data.newPlayerID] = data.newPlayerName;
  lobby();
});

socket.on('gameStarted', (data) => {

  // set up player dicts and arrays before starting the game
  let counter = 0;
  Object.keys(playerNames).forEach((playerID) => {
    playerTiles[playerID] = [];
    playerIndices[playerID] = counter;
    players[counter] = playerID;
    counter++;
  });

  myTiles = data.startingTiles;
  activePlayer = data.activePlayer;
  setupGame();
});

socket.on('myTiles', (data) => {
  // update the selection panel with new tile
  myTiles = data;
  updateSelectionPanel();
});

socket.on('updateState', (data) => {
 
  map = data.map;
  renderMap();

  playerTiles = data.tilesTaken;
  renderTiles();

  activePlayer = data.activePlayer;

  $('.playerDiv').css("background-color", "white");
  // make sure the game is not finished
  // mark the active player
  if (activePlayer) {
    $(`#${playerIndices[activePlayer]}.playerDiv`).css("background-color", "yellow");
  }
});

socket.on('gameEnd', (data) => {
  let winType = data[0];
  let winners = [];
  data[1].forEach((playerID) => {
    winners.push(playerNames[playerID]);
  });
  endGame(winType, winners);
});

socket.on('err', (data) => {
  alert(data.message);
});

// responsive layout for the game window
function resize() {
  let ratio = 1;
  let width = window.innerWidth * 100 / 100;
  let height = window.innerHeight * 50 / 100;
  // let width = window.innerWidth * 95 / 100;
  // let height = window.innerHeight * 90 / 100;
  let widthToHeight = width / height;
  if (widthToHeight > ratio) {
    width = height * ratio;
  } else {
    height = width / ratio;
  }
  tileSize = (height / (mapSize + 1)) | 0;
  fontSize = (8 / 10 * tileSize) | 0;
  cells = document.querySelectorAll("#board td");
  for (i = 0; i < cells.length; ++i) {
    cells[i].height = tileSize;
    cells[i].width = tileSize;
    cells[i].style.font = fontSize + 'px Impact';
  }
}

function form() {
  clearGame();
  $("#board").append('<input type="text" name="name" id="name" placeholder="Enter your name" required>');
  $("#board").append('<input type="text" name="room" id="room" placeholder="Enter Game ID" required>');
  $("#board").append('<button id="new">New game</button>');
  $("#board").append('<button id="join">Join game</button>');


  // // ---------------- TESTING ONLY -----------
  // $("#board").append('<br><br><button id="test1">Test 1</button>');
  // $("#board").append('<button id="test2">Test 2</button>');
  // $('#test1').on('click', () => {           //
  //   name = 'player1';                       //
  //   socket.emit('createGame', {name});      //
  // });                                       //
  //                                           //
  // $('#test2').on('click', () => {           //
  //   name = 'player2';                       //
  //   room = 0;                               //
  //   socket.emit('joinGame', {name, room});  //
  // });                                       //
  // // ---------------- TESTING ONLY -----------

  // Create a new game. Emit newGame event.
  $('#new').on('click', () => {
    name = $('#name').val();
    if (!name) {
      alert('Please enter your name.');
      return;
    }
    socket.emit('createGame', {name});
  });

  // Join an existing game on the entered roomId. Emit the joinGame event.
  $('#join').on('click', () => {
    name = $('#name').val();
    room = $('#room').val();
    if (!name || !room) {
      alert('Please enter your name and room ID.');
      return;
    }
    socket.emit('joinGame', {name, room});
  });
}

function lobby() {
  clearGame();
  $("#board").append(`<h1>The room ID is <b>${room}</b>.</h1><br>`);
  $("#board").append('<button id="start">Start game</button><br><br>');

  $('#start').on('click', () => {
  socket.emit('startGame');
  });

  $("#board").append(`<h2>Players:</h2>`);
  let h = document.createElement("h3")
  Object.values(playerNames).forEach(player => {
    h.appendChild(document.createTextNode(player));
    h.append(document.createElement("br"))
  });
  $("#board").append(h)
};

// clicked on a tile
function placeTile() {
  // send a request to the server
  if (activePlayer === myID) {
    socket.emit('playTurn', {selection, x: this.x, y: this.y});
  }
}

function changeSelection() {
  $('.sel').each(function() {
    this.style.backgroundColor = 'grey';
  });
  this.style.backgroundColor = colours[playerIndices[myID]];
  selection = this.id;
}

// render the current state of the game on top of the grey board
function renderMap() {
  for (x = 0; x < mapSize; x++) {
    for (y = 0; y < mapSize; y++) {
      if (map[x][y][0] !== 0) {
        $(`#${x}${y}.map`).html(map[x][y][1]);
        $(`#${x}${y}.map`).css("background-color", colours[playerIndices[map[x][y][0]]]);
      }
    }
  }
}

function renderTiles() {

  Object.keys(playerTiles).forEach((playerID) => {
    $(`#${playerIndices[playerID]}.taken`).html('');
    playerTiles[playerID].forEach((takenTile) => {
      let cell = document.createElement('td');
      cell.setAttribute('height', tileSize);
      cell.setAttribute('width', tileSize);
      cell.setAttribute('align', 'center');
      cell.setAttribute('valign', 'center');
      cell.style.color = 'black';
      cell.style.font = fontSize + 'px Impact';


      cell.style.backgroundColor = colours[playerIndices[takenTile[0]]];
      cell.innerHTML = takenTile[1];
      $(`#${playerIndices[playerID]}.taken`).append(cell);
    });
  });

}

function symbolCheck(x, y) {
  return symbols[3 * Math.floor(x / 3) + Math.floor(y / 3)];
}

function endGame(winType, winners) {
  // leave the map drawn for viewing
  if (winType === 'win') {
    alert(`${winners} has won the game!`);
  } else {
    alert(`${winners.join(" and ")} have tied, nobody is a winner :(`);
  }
  // add a button to leave the game
  $("#board").append('<button id="restart">Back to start</button>');
  $('#restart').on('click', () => {
    // do any variables need clearing?
    // room = '';
    playerNames = {};
    playerTiles = {};
    playerIndices = {};
    players = [];
    map = [
      [[0], [0], [0], [0], [0], [0], [0], [0], [0]],
      [[0], [0], [0], [0], [0], [0], [0], [0], [0]],
      [[0], [0], [0], [0], [0], [0], [0], [0], [0]],
      [[0], [0], [0], [0], [0], [0], [0], [0], [0]],
      [[0], [0], [0], [0], [0], [0], [0], [0], [0]],
      [[0], [0], [0], [0], [0], [0], [0], [0], [0]],
      [[0], [0], [0], [0], [0], [0], [0], [0], [0]],
      [[0], [0], [0], [0], [0], [0], [0], [0], [0]],
      [[0], [0], [0], [0], [0], [0], [0], [0], [0]],
    ];
    selection = 0;
    myTiles = [];
    form();
  });      
}

function clearGame() {
  $("#board").empty();
  $("#selectionPanel").empty();
  $("#userPanel").empty();
}

// render the background
function renderBoard() {
  resize();
  let board = document.createElement('table');
  board.id = 'boardTable';
  board.setAttribute('border', 1);
  board.setAttribute('cellspacing', 1);
  for (x = -1; x < mapSize; x++) {
    var row = document.createElement('tr');
    board.appendChild(row);
    for (y = -1; y < mapSize; y++) {
      var cell = document.createElement('td');
      cell.setAttribute('height', tileSize);
      cell.setAttribute('width', tileSize);
      cell.setAttribute('align', 'center');
      cell.setAttribute('valign', 'center');
      // cell.style.backgroundColor = 'grey';
      cell.style.font = fontSize + 'px Impact';
      if (x === -1 && y === -1) {
        cell.innerHTML = '';
        cell.style.backgroundColor = 'white';
      } else if (x === -1) {
        cell.innerHTML = letters[y];
      } else if (y === -1) {
        cell.innerHTML = numbers[x];
      } else {
        cell.innerHTML = symbolCheck(x, y);
        cell.x = x;
        cell.y = y;
        cell.id = `${x}${y}`;
        // cell.addEventListener('mouseover', mouseHover);
        // cell.addEventListener('mouseout', mouseGone);
        cell.classList.add('clickable', 'map');
        cell.addEventListener('click', placeTile);
      }
      row.appendChild(cell);
    }
  }
  $("#board").append(board);
}

function renderSelectionPanel() {
  $("#selectionPanel").append(document.createElement('br'));
  let table = document.createElement('table');
    let row = document.createElement('tr');
    table.id = 'selectionTable';
    $("#selectionPanel").append(table);
  for (s = 0; s < 5; s++) {
    var cell = document.createElement('td');
    cell.setAttribute('height', tileSize);
    cell.setAttribute('width', tileSize);
    cell.setAttribute('align', 'center');
    cell.setAttribute('valign', 'center');
    cell.classList.add('clickable', 'sel');
    cell.style.font = fontSize + 'px Impact';
    cell.innerHTML = myTiles[s];
    cell.s = s;
    cell.id = s;
    cell.addEventListener('click', changeSelection);
    row.appendChild(cell);
  }
  table.appendChild(row);
  $(`#${selection}.sel`).css("background-color", colours[playerIndices[myID]]);
}

function updateSelectionPanel() {
for (s = 0; s < 5; s++) {
  $(`#${s}.sel`).html(myTiles[s]);
}
}

function addTakenTile(replaced, playerID) {
  let cell = document.createElement('td');
  cell.setAttribute('height', tileSize);
  cell.setAttribute('width', tileSize);
  cell.setAttribute('align', 'center');
  cell.setAttribute('valign', 'center');
  cell.style.backgroundColor = colours[playerIndices[replaced[0]]];
  cell.style.color = 'black';
  cell.style.font = fontSize + 'px Impact';
  cell.innerHTML = replaced[1];
  $(`#${playerIndices[playerID]}.taken`).append(cell);
}

function renderPlayersPanel() {
  Object.keys(playerNames).forEach((playerID) => {
    let playerDiv = document.createElement('div');
    playerDiv.classList.add('playerDiv');
    playerDiv.id = playerIndices[playerID];
    // change player name's colour
    playerDiv.style.color = colours[playerIndices[playerID]];
    playerDiv.style.fontWeight = "900";
    playerDiv.append(document.createTextNode(playerNames[playerID]));
    let table = document.createElement('table');
    let row = document.createElement('tr');
    row.classList.add('taken');
    row.id = playerIndices[playerID];
    table.append(row);
    playerDiv.append(table);
    $("#userPanel").append(playerDiv);
  });
  // mark the active player
  $(`#${playerIndices[activePlayer]}.playerDiv`).css("background-color", "yellow");
}

function setupGame() {
  clearGame();
  renderBoard();
  renderSelectionPanel();
  renderPlayersPanel();
}

form();