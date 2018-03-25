
var ready = false;
var eurecaServer;
var myId;
var ship;
//var player;
//this function will handle client communication with the server
var eurecaClientSetup = function() {
    //create an instance of eureca.io client
    var eurecaClient = new Eureca.Client();
    
    eurecaClient.ready(function (proxy) {       
        eurecaServer = proxy;
        
        
        //we temporary put create function here so we make sure to launch the game once the client is ready
        create();
        ready = true;
    });

    //methods defined under "exports" namespace become available in the server side
    
    eurecaClient.exports.setId = function(id) 
    {
        myId = id;
        create();
        eurecaServer.handshake();
        ready = true;
    }   
    
    eurecaClient.exports.kill = function(id)
    {   
        if (players[id]) {
            players[id].kill();
            console.log('killing ', id, players[id]);
        }
    }

    eurecaClient.exports.fire = function(id) {
        if (id != myId)
            players[id].fireBullet();
    }   
    
    eurecaClient.exports.spawnPlayer = function(i, x, y)
    {
        
        if (i == myId) return; //this is me
        
        console.log('SPAWN');
        var plr = new Spaceship(i, game, 'player');
        players[i] = plr;
    }

    eurecaClient.exports.updateState = function(id, state)
    {
        if (players[id])  {
            players[id].cursor = state;
            players[id].ship.x = state.x;
            players[id].ship.y = state.y;
            players[id].update();
        }
    }

    eurecaClient.exports.alienKill = function(playerIdx, bulletIdx, alienIdx) {
        alien = aliens.children[alienIdx];
        if (alien && alien.alive) {
            console.log("Killing!!");
            alien.kill();
        }
        var bullet = players[playerIdx].bullets.children[bulletIdx];
        bullet.kill();
        var explosion = explosions.getFirstExists(false);
        explosion.reset(alien.body.x, alien.body.y);
        explosion.play('kaboom', 30, false, true);
        if (aliens.countLiving() == 0) {
            score += 1000;
            scoreText.text = scoreString + score;

            enemyBullets.callAll('kill');
            stateText.text = " You Won, \n Click to restart";
            stateText.visible = true;

            //the "click to restart" handler
            game.input.onTap.addOnce(restart,this);
        }
    }

    eurecaClient.exports.hitPlayer = function(playerIdx, bulletIdx) {
        var bullet = enemyBullets.children[bulletIdx];
        bullet.kill();
        var playerHit = players[playerIdx];
        var live = playerHit.lives.getFirstAlive();
        if (live)
            live.kill();
        //  And create an explosion :)
        var explosion = explosions.getFirstExists(false);
        explosion.reset(playerHit.ship.body.x, playerHit.ship.body.y);
        explosion.play('kaboom', 30, false, true);

        // When the player dies
        if (playerHit.lives.countLiving() < 1)
        {
            playerHit.ship.kill();
            enemyBullets.callAll('kill');

            stateText.text=" GAME OVER \n Click to restart";
            stateText.visible = true;

            //the "click to restart" handler
            game.input.onTap.addOnce(restart,this);
        }
    }

    eurecaClient.exports.restart = function () {

    //  A new level starts
    
    //resets the life count
    for (var i in players)
    {
       players[i].lives.callAll('revive');    //  And brings the aliens back from the dead :)
           //revives the player
       players[myId].ship.revive();
    }
    aliens.removeAll();
    createAliens();
    //hides the text
    stateText.visible = false;
    }
    
    //playerId - ship towards which the bullets are launched(last one asked for enemy bullets)
    eurecaClient.exports.fireEnemyBullet = function (random, playerId) {

        aliens.forEachAlive(function(alien){
            livingEnemies.push(alien);
        });

        enemyBullet = enemyBullets.getFirstExists(false)

        if (enemyBullet && livingEnemies.length > 0) {
            var shooter=livingEnemies[random];
            enemyBullet.reset(shooter.body.x, shooter.body.y);
            game.physics.arcade.moveToObject(enemyBullet,players[playerId].ship,120);
            firingTimer = game.time.now + 2000;
        }
    }
 
}

var game = new Phaser.Game(800, 600, Phaser.AUTO, 'phaser-example', { preload: preload, create: eurecaClientSetup, update: update, render: render });

function preload() {

    game.load.image('bullet', 'assets/bullet.png');
    game.load.image('enemyBullet', 'assets/enemy-bullet.png');
    game.load.spritesheet('invader', 'assets/invader32x32x4.png', 32, 32);
    game.load.image('ship', 'assets/player.png');
    game.load.spritesheet('kaboom', 'assets/explode.png', 128, 128);
    game.load.image('starfield', 'assets/starfield.png');
    game.load.image('background', 'assets/background2.png');

}

//var player;
var aliens;
var bullets;
var bulletTime = 0;
var cursors;
var fireButton;
var explosions;
var starfield;
var score = 0;
var scoreString = '';
var scoreText;
var lives;
var enemyBullet;
var firingTimer = 0;
var stateText;
var livingEnemies = [];
var players = [];
var ship;

Spaceship = function(index, game, player) {
    this.cursor = {
        left: false,
        right: false,
        fire: false
    }

    this.input = {
        left: false,
        right: false,
        fire: false
    }

    this.game = game;
    this.player = player;
        //  Our bullet group
    this.bullets = game.add.group();
    this.bullets.enableBody = true;
    this.bullets.physicsBodyType = Phaser.Physics.ARCADE;
    this.bullets.createMultiple(30, 'bullet');
    this.bullets.setAll('anchor.x', 0.5);
    this.bullets.setAll('anchor.y', 1);
    this.bullets.setAll('outOfBoundsKill', true);
    this.bullets.setAll('checkWorldBounds', true);

    var x = 400;
    var y = 500;
    
    this.idx = index;
    this.ship = game.add.sprite(x, y, 'ship');
    this.ship.anchor.setTo(0.5, 0.5);
    this.ship.id = index;
    game.physics.enable(this.ship, Phaser.Physics.ARCADE);

    this.lives = game.add.group();
    for (var i = 0; i < 3; i++) 
    {
        var ship = this.lives.create(game.world.width - 100 + (30 * i), 60, 'ship');
        ship.anchor.setTo(0.5, 0.5);
        ship.angle = 90;
        ship.alpha = 0.4;
    }
}

Spaceship.prototype.kill = function() {
    this.ship.kill();
    this.lives.calAll('kill');
    this.bullets.calAll('kill');
}

Spaceship.prototype.update = function() {
    console.log("update called for " + this.ship.id)
    this.ship.body.velocity.setTo(0, 0);
    var inputChanged = (
        this.cursor.left != this.input.left ||
        this.cursor.right != this.input.right ||
        this.cursor.fire != this.input.fire
    );
    
    
    if (inputChanged)
    {
        //Handle input change here
        //send new values to the server     
        if (this.ship.id == myId) {
            // send latest valid state to the server
            this.input.x = this.ship.x;
            this.input.y = this.ship.y;
            eurecaServer.handleKeys(this.input);
        }
    }

    //cursor value is now updated by eurecaClient.exports.updateState method

    if (this.ship.alive) {
        if (this.cursor.left) {
            this.ship.body.velocity.x = -200;
        }
        else if (this.cursor.right) {
            this.ship.body.velocity.x = 200;
        }   
        if (this.cursor.fire) {   
            this.fireBullet();
        }
    }        
}

Spaceship.prototype.fireBullet = function() {

    //  To avoid them being allowed to fire too fast we set a time limit
    if (game.time.now > bulletTime)
    {
        //  Grab the first bullet we can from the pool
        bullet = this.bullets.getFirstExists(false);

        if (bullet)
        {
            //  And fire it
            bullet.reset(this.ship.x, this.ship.y + 8);
            bullet.body.velocity.y = -400;
            bulletTime = game.time.now + 200;
            eurecaServer.fire(myId);
        }
    }
}

function create() {

    console.log("HELLO, WORLD!");
    game.physics.startSystem(Phaser.Physics.ARCADE);

    //  The scrolling starfield background
    starfield = game.add.tileSprite(0, 0, 800, 600, 'starfield');

    player = new Spaceship(myId, game, ship);
    players[myId] = player;

    // The enemy's bullets
    enemyBullets = game.add.group();
    enemyBullets.enableBody = true;
    enemyBullets.physicsBodyType = Phaser.Physics.ARCADE;
    enemyBullets.createMultiple(30, 'enemyBullet');
    enemyBullets.setAll('anchor.x', 0.5);
    enemyBullets.setAll('anchor.y', 1);
    enemyBullets.setAll('outOfBoundsKill', true);
    enemyBullets.setAll('checkWorldBounds', true);

    //  The baddies!
    aliens = game.add.group();
    aliens.enableBody = true;
    aliens.physicsBodyType = Phaser.Physics.ARCADE;

    createAliens();

    //  The score
    scoreString = 'Score : ';
    scoreText = game.add.text(10, 10, scoreString + score, { font: '34px Arial', fill: '#fff' });

    //  Lives
    game.add.text(game.world.width - 100, 10, 'Lives : ', { font: '34px Arial', fill: '#fff' });

    //  Text
    stateText = game.add.text(game.world.centerX,game.world.centerY,' ', { font: '84px Arial', fill: '#fff' });
    stateText.anchor.setTo(0.5, 0.5);
    stateText.visible = false;

/*    for (var i = 0; i < 3; i++) 
    {
        var ship = player.lives.create(game.world.width - 100 + (30 * i), 60, 'ship');
        ship.anchor.setTo(0.5, 0.5);
        ship.angle = 90;
        ship.alpha = 0.4;
    } */

    //  An explosion pool
    explosions = game.add.group();
    explosions.createMultiple(30, 'kaboom');
    explosions.forEach(setupInvader, this);

    //  And some controls to play the game with
    cursors = game.input.keyboard.createCursorKeys();
    fireButton = game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);
    
}

function createAliens () {

    for (var y = 0; y < 4; y++)
    {
        for (var x = 0; x < 10; x++)
        {
            var alien = aliens.create(x * 48, y * 50, 'invader');
            alien.anchor.setTo(0.5, 0.5);
            alien.animations.add('fly', [ 0, 1, 2, 3 ], 20, true);
            alien.play('fly');
            alien.body.moves = false;
        }
    }

    aliens.x = 100;
    aliens.y = 50;

    //  All this does is basically start the invaders moving. Notice we're moving the Group they belong to, rather than the invaders directly.
    var tween = game.add.tween(aliens).to( { x: 200 }, 2000, Phaser.Easing.Linear.None, true, 0, 1000, true);

    //  When the tween loops it calls descend
    tween.onLoop.add(descend, this);
}

function setupInvader (invader) {

    invader.anchor.x = 0.5;
    invader.anchor.y = 0.5;
    invader.animations.add('kaboom');

}

function descend() {

    aliens.y += 10;

}

function update() {

    if (!ready) return;
    //  Scroll the background
    starfield.tilePosition.y += 2;

    //player.input.left = cursors.left.isDown;
    //player.input.right = cursors.right.isDown;
    //player.input.fire = game.input.activePointer.isDown;

    if (players[myId].ship.alive)  {
        //  Reset the player, then check for movement keys
        player.ship.body.velocity.setTo(0, 0);

        players[myId].input.left = cursors.left.isDown;
        players[myId].input.right = cursors.right.isDown;
        players[myId].input.fire = fireButton.isDown;
        players[myId].update();

        //  Run collision
        game.physics.arcade.overlap(player.bullets, aliens, collisionHandler, null, player);
        game.physics.arcade.overlap(enemyBullets, players[myId].ship, enemyHitsPlayer, null, players[myId]);
    }
        
    for (var i in players) {
        if (!players[i]) continue;
        if (i != myId && players[i].alive) {
            players[i].update();
            console.log("I'm here!(not your player!)");
            game.physics.arcade.overlap(players[i].bullets, aliens, collisionHandler, null, players[i]);
            game.physics.arcade.overlap(enemyBullets, players[i].ship, enemyHitsPlayer, null, players[i]);
            players[i].ship.body.velocity.setTo(0, 0);
        }
    }

    if (this.game.time.now > firingTimer) {
        enemyFires();
    }
}

function render() {

    // for (var i = 0; i < aliens.length; i++)
    // {
    //     game.debug.body(aliens.children[i]);
    // }

}

function collisionHandler(bullet, alien) {

    //  When a bullet hits an alien we kill them both
    console.log("Hello! collision handler!!");
    eurecaServer.killAlien(this.bullets.getChildIndex(bullet), aliens.getChildIndex(alien));
    bullet.kill();
    alien.kill();

    //  Increase the score
    score += 20;
    scoreText.text = scoreString + score;

    //  And create an explosion :)
    var explosion = explosions.getFirstExists(false);
    explosion.reset(alien.body.x, alien.body.y);
    explosion.play('kaboom', 30, false, true);

    if (aliens.countLiving() == 0)
    {
        score += 1000;
        scoreText.text = scoreString + score;

        enemyBullets.callAll('kill');
        stateText.text = " You Won, \n Click to restart";
        stateText.visible = true;

        //the "click to restart" handler
        game.input.onTap.addOnce(restart,this);
    }
}


function enemyHitsPlayer (ship,bullet) {

    eurecaServer.hitPlayer(enemyBullets.getChildIndex(bullet));
    
    bullet.kill();

    live = this.lives.getFirstAlive();

    if (live)
    {
        live.kill();
    }

    //  And create an explosion :)
    var explosion = explosions.getFirstExists(false);
    explosion.reset(ship.body.x, ship.body.y);
    explosion.play('kaboom', 30, false, true);

    // When the player dies
    if (this.lives.countLiving() < 1)
    {
        ship.kill();
        enemyBullets.callAll('kill');

        stateText.text=" GAME OVER \n Click to restart";
        stateText.visible = true;

        //the "click to restart" handler
        game.input.onTap.addOnce(restart,this);
    }

}

function enemyFires () {

    //  Grab the first bullet we can from the pool
    enemyBullet = enemyBullets.getFirstExists(false);

    livingEnemies.length=0;

    aliens.forEachAlive(function(alien){

        // put every living enemy in an array
        livingEnemies.push(alien);
    });

    eurecaServer.enemyFires(livingEnemies.length);

    /*if (enemyBullet && livingEnemies.length > 0)
    {
        
        //var random=game.rnd.integerInRange(0,livingEnemies.length-1);

        // randomly select one of them
        var shooter=livingEnemies[random];
        // And fire the bullet from this enemy
        enemyBullet.reset(shooter.body.x, shooter.body.y);

        game.physics.arcade.moveToObject(enemyBullet,players[myId].ship,120);
        firingTimer = game.time.now + 2000;
    }*/

}


function resetBullet (bullet) {

    //  Called if the bullet goes out of the screen
    bullet.kill();

}

function restart () {

    //  A new level starts
    
    //resets the life count
    players[myId].lives.callAll('revive');
    //  And brings the aliens back from the dead :)
    aliens.removeAll();
    createAliens();

    //revives the player
    players[myId].ship.revive();
    //hides the text
    stateText.visible = false;

    eurecaServer.restart();

}
