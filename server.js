var express = require('express'), app = express(app), server = require('http').createServer(app);
// serve static files from the current directory
app.use(express.static(__dirname));
server.listen(8000);

 
//get EurecaServer class
var EurecaServer = require('eureca.io').EurecaServer;
 
//create an instance of EurecaServer
var eurecaServer = new EurecaServer({allow:['setId', 'spawnPlayer', 'kill', 'updateState', 'fire', 'alienKill', 'hitPlayer', 'restart', 'fireEnemyBullet']});
 
//attach eureca.io to our http server
eurecaServer.attach(server);

var clients = [];

eurecaServer.onConnect(function (conn) {    
    console.log('New Client id=%s ', conn.id, conn.remoteAddress);
    
    //the getClient method provide a proxy allowing us to call remote client functions
    var remote = eurecaServer.getClient(conn.id);    
    
    //register the client
    clients[conn.id] = {id:conn.id, remote:remote}
    
    //here we call setId (defined in the client side)
    remote.setId(conn.id);  
});
 
//detect client disconnection
eurecaServer.onDisconnect(function (conn) {    
    console.log('Client disconnected ', conn.id);
    
    var removeId = clients[conn.id].id;
    
    delete clients[conn.id];
    
    for (var c in clients)
    {
        var remote = clients[c].remote;
        
        //here we call kill() method defined in the client side
        remote.kill(conn.id);
    }   
});

eurecaServer.exports.handshake = function()
{
    for (var c in clients)
    {
        var remote = clients[c].remote;
        for (var cc in clients)
        {       
            //send latest known position
            var x = clients[cc].laststate ? clients[cc].laststate.x:  0;
            var y = clients[cc].laststate ? clients[cc].laststate.y:  0;
 
            remote.spawnPlayer(clients[cc].id, x, y);        
        }
    }
}

eurecaServer.exports.handleKeys = function (keys) {
    var conn = this.connection;
    var updatedClient = clients[conn.id];
    
    for (var c in clients)
    {
        var remote = clients[c].remote;
        remote.updateState(updatedClient.id, keys);
        
        //keep last known state so we can send it to new connected clients
        clients[c].laststate = keys;
    }
}

eurecaServer.exports.fire = function () {
    var conn = this.connection;
    var updatedClientId = clients[conn.id].id;

    for (var c in clients) {
        var remote = clients[c].remote;
        remote.fire(updatedClientId);
    }
}

eurecaServer.exports.killAlien = function(bulletIdx, alienIdx) {
    var conn = this.connection;
    var updatedClientId = clients[conn.id].id;
    console.log("I'm here!");
    for (var c in clients) {
        var remote = clients[c].remote;
        if (remote.id != updatedClientId)
            remote.alienKill(updatedClientId, bulletIdx, alienIdx);
    }
}

eurecaServer.exports.hitPlayer = function(bulletIdx) {
    var conn = this.connection;
    var updatedClientId = clients[conn.id].id;
    console.log("I'm here!");
    for (var c in clients) {
        var remote = clients[c].remote;
        if (remote.id != updatedClientId)
            remote.hitPlayer(updatedClientId, bulletIdx);
    }
}

eurecaServer.exports.restart = function() {
    var conn = this.connection;
    var updatedClientId = clients[conn.id].id;
    for (var c in clients) {
        var remote = clients[c].remote;
        if (remote.id != updatedClientId)
            remote.restart();
    }   
}

//to synchronize clients waiting for enemy bullets
var enemyFireTick = 0;

eurecaServer.exports.enemyFires = function(enemiesCnt) {
    ++enemyFireTick;
    if (enemyFireTick < clients.length)
        return;
    var conn = this.connection;
    var updatedClientId = clients[conn.id].id;
    enemyFireTick = 0;
    var random = getRandomInt(enemiesCnt);
    for (var c in clients) {
         var remote = clients[c].remote;
             remote.fireEnemyBullet(random, updatedClientId);
    }  
}

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}