// Seed Dependencies ----------------------------------------------------------
var Class = require('../lib/Class').Class,
    TypedList = require('../lib/TypedList').TypedList,
    is = require('../lib/is').is,
    Base = require('../lib/Base').Base,
    Net = require('../lib/Network').Network,
    Player = require('./Player').Player,
    SyncedSession = require('./SyncedSession').SyncedSession;


// Implementation -------------------------------------------------------------
var Session = Class(function(server, config, remote) {

    is.assert(is.Class(server));
    is.assert(is.Object(config));
    is.assert(is.Class(remote));

    this._token = is.uniqueToken();
    this._server = server;

    this._ownerPlayer = null;
    this._players = new TypedList(Player);
    this._playerId = 0;

    this._isStarted = false;

    Base(this);
    SyncedSession(this, config);

    this.setOwner(this.createPlayerForRemote(remote));
    this.addPlayer(this._ownerPlayer);

}, Base, SyncedSession, {

    // Methods ----------------------------------------------------------------
    start: function() {
        if (this._isStarted) {
            return false;

        } else {
            this._isStarted = true;
            return SyncedSession.start(this);
        }
    },

    broadcast: function(type, data) {
        this._players.each(function(player) {
            if (is.Function(data)) {
                player.send(type, data.call(this, player));

            } else {
                player.send(type, data);
            }

        }, this);
    },

    close: function() {

        console.log(this._players);
        this._players.each(function(player) {
            this.log('Destroying player');
            player.destroy();

        }, this);

        this._server.removeSession(this);

        this.log('Closed');
        Base.destroy(this);

    },


    // Player Management ------------------------------------------------------
    createPlayerForRemote: function(remote) {
        is.assert(Class.is(remote));
        return new Player(this, remote, ++this._playerId);
    },

    addPlayer: function(player) {

        is.assert(Class.is(player, Player));
        is.assert(this._players.add(player));

        this.broadcast(Net.Session.Player.Joined, player.toNetwork());
        this.broadcast(Net.Session.Info.Update, this.toNetwork());
        this._server.sendSessionList();

        this.log('Player joined', player);

        return player;

    },

    removePlayer: function(player) {

        is.assert(Class.is(player, Player));
        is.assert(this._players.remove(player));

        if (this.isRunning()) {
            this.broadcast(Net.Game.Player.Left, player.toNetwork());

        } else {
            this.broadcast(Net.Session.Player.Left, player.toNetwork());
        }

        // TODO exclude running sessions from session list
        this.broadcast(Net.Session.Update, this.toNetwork());
        this._server.sendSessionList();

        this.log('Player left', player);

        // TODO close session when all players left
        //if (this._players.length === 0) {
            //this.close();
        //}

        return player;

    },


    // Getters / Setters ------------------------------------------------------
    getToken: function() {
        return this._token;
    },

    setOwner: function(owner) {
        is.assert(!this._ownerPlayer);
        is.assert(Class.is(owner, Player));
        this.log('Owner set to', owner);
        owner.setReady(true);
        return (this._ownerPlayer = owner);
    },

    isOwnedBy: function(owner) {
        is.assert(Class.is(owner, Player));
        return this._ownerPlayer === owner;
    },

    getOwner: function() {
        return this._ownerPlayer;
    },

    isRunning: function() {
        return this._isStarted;
    },


    // Helpers ------------------------------------------------------------
    toNetwork: function() {
        return {
            token: this.getToken(),
            running: this.isRunning(),
            ready: this.isReady(),
            owner: this._ownerPlayer ? this._ownerPlayer.toNetwork(false) : null,
            playerCount: this._players.length
        };
    },

    toString: function() {
        return 'Session';
    }

});

exports.Session = Session;

