# Tilewars

## About

My first web game using vanilla JS, jQuery, and socket.io. Based on *Blockers (Uptown)* board game.

To be hosted using node.js.

I've hosted it on a Raspberry Pi 4 and it was running very well with a few rooms open at the same time.

## Game rules

The game is based on *Blockers (Uptown)* board game.

The rules are pretty simple.

The goal is to have the fewest number of groups of tiles on the board at the end of the game.

The players take turns placing one of their five tiles on a 9x9 grid and then draw another tile to replace it. There are three tiles which each player can place on each space: a letter, a number, or the item which represents the 3x3 sector of the board the space is in.

If another player has placed a tile it may be captured by playing a legal tile in its place, only if removing the tile doesn't break a group of tiles belonging to the player into more than one group. If players tie for the fewest number of groups at the end of the game, then the winner is the one who captured the fewest opponents' tiles.

Source: https://boardgamegeek.com/boardgame/29073/blockers

## File structure

The repository contains the following files:
- index.html is the main html page that gets served to a client. It has placeholder divs that will be replaced with game content.
- index.js is the server-side javascript file. To be executed with node.js on the server: `node index.js`. It will run the server app, listen to connections at port 80 (can be changed), and manage sockets. It also takes care of the game logic from server side (room management, move validation, etc.).
- tilewars.js is the client side js file. It gets served to the client and is responsible for frontend (drawing game on the page) and socket.io communication with the server.
- style.css is a stylesheet, most of it is redundant legacy stuff
- package.json will help you install all the required packages with npm

## TODO
- [ ] a proper guide on how to set up node.js environment and host the game,
- [ ] general code clean-up - it's a real spaghetti at the moment,
- [ ] too many unnecessary arrays and objects scattered around the code - they were introduced as temporary workarounds, and I never got back to clean them up,
- [ ] more memory efficient algorithms,
- [ ] remove references to objects no longer in use - for example, clean up a game room after the game is finished
- [ ] add an option to rejoin the game
- [ ] after the code is relatively clean, it would be good to move it to a proper framework like react.js

I probably won't ever bother with this project again, though :)

## HOWTO

0. In tilewars.js, change the address in line 45 to your IP/domain:
`const socket = io.connect('http://tilewars.io/');`
1. Install node.js and npm
2. Install all the required node.js packages
3. Run the server with
`node index.js`

You can also set up a systemd service to run node.js at startup.
