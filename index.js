var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

app.use(express.static('.'));

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

// listen at port 80 (http)
server.listen(80);

// start counting room IDs from 0
var roomCount = -1;
// sockets[socket.id] = Game.id
var sockets = {};
// rooms[Game.id] = Game
var rooms = {};

// find a game the socket belongs to:
// game = rooms[sockets[socket.id]]
// find the player:
// player = game.players[socket.id]

io.on('connection', (socket) => {
  console.log(socket.id + ' has connected to the server.')

  // a workaround if the connection is dropped
  // allows the user to reonnect and continue the game as himself
  socket.on('user-reconnected', (data) => {
    try {
      console.log(`${socket.id} has reconnected as ${data.previousID}`);
      socket.id = data.previousID;
    }
    catch (err) {
      console.log('the user was not in a game')
    }
  });

  // Create a new game room and announce the game ID.
  socket.on('createGame', (data) => {
    let newRoomID = ++roomCount;
    rooms[newRoomID] = new Game(`${newRoomID}`);
    rooms[newRoomID].addPlayer(socket, data.name);
    let newPlayerID = socket.id;
    socket.join(`${newRoomID}`);
    socket.emit('newGame', {newRoomID, newPlayerID});
  });

  // Connect other players to the specific room ID. Show error if room full.
  socket.on('joinGame', (data) => {
    try {
      if (rooms[data.room].addPlayer(socket, data.name)) {
        let newPlayerID = socket.id;
        let playerNames = rooms[data.room].playerNames();
        socket.emit('gameJoined', {newPlayerID, playerNames});
        socket.to(data.room).emit('playerJoined', {newPlayerID, newPlayerName: data.name});
        socket.join(data.room);
      }
      else {
        socket.emit('err', {message: `Room ${data.room} is full or the game has already started.`});
      }
    }
    catch(err) {
      console.log(`User tried to connect to a room that does not exist. ${err}`)
      socket.emit('err', {message: `Room ${data.room} does not exist.`});
    }
  });

  // Start the game
  socket.on('startGame', (data) => {
    let game = rooms[sockets[socket.id]];
    if (game.start()) {
      // send each player his starting tiles and the ID of the starting player
      Object.values(game.players).forEach((player) => {
        player.socket.emit('gameStarted', {startingTiles: player.toBeUsed, activePlayer: game.activePlayer});
      });
    } else {
      socket.emit('err', {message: `Not enough players to start the game.`});
    }
  });

  // Handle the turn played by a player and notify the others.
  socket.on('playTurn', (data) => {
    let playerID = socket.id;
    let game = rooms[sockets[playerID]];
    try {
      let response = game.playTurn(playerID, data.selection, data.x, data.y);
      console.log(`Player ${playerID} number of groups: ` + game.numberOfGroups(game.map, playerID));
      switch(response) {
        case 1:
          socket.emit('err', {message: `The game is not currently running.`});
          break;
        case 2:
          socket.emit('err', {message: `It is not your turn.`});
          break;
        case 3:
          socket.emit('err', {message: `This symbol cannot be placed here.`});
          break;
        case 4:
          socket.emit('err', {message: `You cannot replace your own tile.`});
          break;
        case 5:
          socket.emit('err', {message: `You cannot split groups in two.`});
          break;
        default:

          // everyone else
          socket.to(game.id).emit('updateState', {
            map: game.map,
            tilesTaken: game.tilesTaken(),
            activePlayer: response.nextPlayer
          });

          // the player who just made the move
          socket.emit('updateState', {
            map: game.map,
            tilesTaken: game.tilesTaken(),
            activePlayer: response.nextPlayer
          });

          // tell each player what his tiles are
          game.myTiles();

          // check if the game has ended
          if (response.nextPlayer === false) {
            let data = game.end()
            socket.to(game.id).emit('gameEnd', data);
            socket.emit('gameEnd', data);
            socket.leave(game.id);
          }

        };
      }
      // in case something goes wrong - the code is pretty much alpha!
      // prints out debug information
      catch(err) {
        console.log(err);
        console.log('turn played:');
        console.log(data);
        console.log(rooms);
        console.log(sockets);
        console.log(socket.id);
      }
  });
});

// board properties
const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const symbols = ['%', '^', '&', '*', '(', '#', '@', '/', '_'];
const mapSize = 9;

class Player {
  constructor(socket, name) {
    this.name = name;
    this.socket = socket;
    this.collected = [];
    this.notRevealed = this.shuffle(letters.concat(numbers, symbols, ['$']));
    this.toBeUsed = this.notRevealed.splice(23,5);
  }

  // get random tiles at the beginning of the game
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // draw next tile after a move
  drawTile(selection) {
    this.toBeUsed[selection] = this.notRevealed.pop();
    return this.toBeUsed[selection];
  }

}

class Game {
  constructor(id) {
    this.id = id;
    this.map = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];
    // list of players, access with socket.id:
    // this.players[socket.id]
    this.players = {};
    // index of the active player
    this.activePlayerIndex = 0;
    // player who is taking turn now
    this.activePlayer;
    // a flag indicating whether the game is running or not
    this.running = false;
    // number of turns each player has
    this.turns = 24;
  }

  // add a player to the room
  addPlayer(socket, name) {
    if (this.playerCount() < 5 && !this.running) {
      sockets[socket.id] = this.id;
      this.players[socket.id] = new Player(socket, name);
      console.log(`${name} joined room ${this.id}.`);
      return true;
    } else {
      return false;
    }
  }

  // returns a dict {playerID: name}
  playerNames() {
    let nameDict = {};
    Object.keys(this.players).forEach(playerID => {
      nameDict[playerID] = this.players[playerID].name;
    });
    return nameDict;
  }

  // returns an array of {socket.id: [tilesTaken]}
  tilesTaken() {
    let tilesTaken = {};
    Object.keys(this.players).forEach(playerID => {
      console.log(`Tiles taken by player ${playerID}: ${this.players[playerID].collected}`)
      tilesTaken[playerID] = this.players[playerID].collected;
    });
    return tilesTaken;
  }

  // tells every player what tiles they have available for playing
  myTiles() {
    console.log(`players: ${this.players}`);
    Object.keys(this.players).forEach(playerID => {
      let player = this.players[playerID];
      let myTiles = player.toBeUsed;
      player.socket.emit('myTiles', myTiles);
    });
    return;
  }

  // returns a number of players currently in game
  playerCount() {
    return Object.keys(this.players).length;
  }

  // return the ID of the next active player
  nextPlayer() {
    if (this.activePlayerIndex < this.playerCount() - 1) {
      this.activePlayerIndex += 1;
    } else {
      this.turns -= 1;
      this.activePlayerIndex = 0;
    }
    if (this.turns === 0) {
      return false;
    } else {
      this.activePlayer = Object.keys(this.players)[this.activePlayerIndex];
      return this.activePlayer;
    }
  }

  // returns the playerID of the owner of the tile
  tileOwner(x, y) {
    return this.map[x][y][0];
    // return parseInt(this.map[x][y][0]);
  }

  // check if the given tile is already occupied
  takenCheck(x, y) {
    return this.map[x][y] !== 0;
  }

  // check what letter can be placed on the given tile
  letterCheck(y) {
    return letters[y];
  }

  // check what number can be placed on the given tile
  numberCheck(x) {
    return numbers[x];
  }

  // check what symbol can be placed on the given tile
  symbolCheck(x, y) {
    return symbols[3 * Math.floor(x / 3) + Math.floor(y / 3)];
  }

  // floodfill algorithm - useful for counting groups
  floodFill(boardState, x, y) {
    let playerID = boardState[x][y][0];
    boardState[x][y] = 0;
    if (x > 0) {
      // to the left
      if (boardState[x - 1][y][0] === playerID) {
        boardState = this.floodFill(boardState, x - 1, y);
      }
    }
    if (x < mapSize - 1) {
      // to the right
      if (boardState[x + 1][y][0] === playerID) {
        boardState = this.floodFill(boardState, x + 1, y);
      }
    }
    if (y > 0) {
      // to the bottom
      if (boardState[x][y - 1][0] === playerID) {
        boardState = this.floodFill(boardState, x, y - 1);
      }
    }
    if (y < mapSize - 1) {
      // to the top
      if (boardState[x][y + 1][0] === playerID) {
        boardState = this.floodFill(boardState, x, y + 1);
      }
    }
    return boardState;
  }

  // return the number of groups a specific player has
  numberOfGroups(boardState, playerID) {
    let groups = 0;
    for (let x = 0; x < mapSize - 1; x++) {
      for (let y = 0; y < mapSize - 1; y++) {
        if (boardState[x][y][0] === playerID) {
          groups++;
          boardState = this.floodFill(JSON.parse(JSON.stringify(boardState)), x, y);
        }
      }
    }
    return groups;
  }

  // returns true if replacing the tile would cause a split into 2 groups
  splitCheck(x, y) {
    let tileOwner = this.tileOwner(x, y);
    // deep copy of the map object literal
    // a workaround to JS's pass by reference
    let newMap = JSON.parse(JSON.stringify(this.map));
    newMap[x][y] = ['X', 'X'];
    if (this.numberOfGroups(this.map, tileOwner) < this.numberOfGroups(newMap, tileOwner)) {
      return true;
    }
    return false;
  }

  // start the game
  start() {
    if (this.playerCount() > 1 && !this.running) {
      this.running = true;
      this.activePlayer = Object.keys(this.players)[this.activePlayerIndex];
      console.log(`Game started, ID = ${this.id}. ${this.playerCount()} players:`);
      console.log(this.playerNames());
      return true;
    }
    return false;
  }
  
  // handle a request to place a tile
  playTurn(playerID, selection, x, y) {
    // if this player is active & tiles can be placed there, send the update to everyone
    let player = this.players[playerID];
    let character = player.toBeUsed[selection];
    let replaced = false;
    if (!this.running) {
      // game not running (not started or ended)
      return 1;
    } else if (playerID !== this.activePlayer) {
      // not your turn
      return 2;
    // game running + your turn
    } else if ((character !== this.symbolCheck(x, y) &&
                character !== this.letterCheck(y) &&
                character !== this.numberCheck(x) &&
                character !== '$')) {
      // the tile cannot be placed here
      return 3;
    } else if (this.takenCheck(x, y)) {
      // tile is already owned
      if (playerID === this.tileOwner(x, y)) {
        // you cannot replace your own tile
        return 4;
      } else if (this.splitCheck(x, y)) {
        // replacing the tile would split a group into 2 groups
        return 5;
      } else {
        // tile owned by someone else but will be replaced
        replaced = this.map[x][y];
        player.collected.push(replaced);
      }
    }
    // replace the tile
    this.map[x][y] = [playerID, character];
    // get new tile
    let tileDrawn = player.drawTile(selection);
    let response = {drawn: tileDrawn,
                    char: character,
                    replaced: replaced,
                    x: x,
                    y: y,
                    nextPlayer: this.nextPlayer()
                   }
    return response;
  }

  end() {
    this.running = false;
    // see who has the least number of groups
    let playersWithLeastGroups = [];
    let minimumGroups = 100;
    Object.keys(this.players).forEach(playerID => {
      let groups = this.numberOfGroups(this.map, playerID);
      if (groups < minimumGroups) {
        playersWithLeastGroups = [playerID];
        minimumGroups = groups;
      } else if (groups === minimumGroups) {
        playersWithLeastGroups.push(playerID);
      }
    });

    // if just one player, announce a winner
    if (playersWithLeastGroups.length === 1) {
      return ['win', playersWithLeastGroups];
    }

    // otherwise, see who has the least number of tiles collected
    let playersWithLeastCollected = [];
    let minimumCollected = 100;
    playersWithLeastGroups.forEach(playerID => {
      let collected = this.players[playerID].collected.length;
      if (collected < minimumCollected) {
        playersWithLeastCollected = [playerID];
        minimumCollected = collected;
      } else if (collected === minimumCollected) {
        playersWithLeastCollected.push(playerID);
      }
    });

    // if just one player, announce a winner
    if (playersWithLeastCollected.length === 1) {
      return ['win', playersWithLeastCollected];
    }

    // otherwise, announce a tie
    return ['tie', playersWithLeastCollected];
  }
}