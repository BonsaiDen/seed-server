// Seed Dependencies ----------------------------------------------------------
var Class = require('../lib/Class').Class,
    TypedList = require('../lib/TypedList').TypedList,
    is = require('../lib/is').is,
    Base = require('../lib/Base').Base,
    Net = require('../lib/Network').Network,
    Player = require('./Player').Player,
    SyncedSession = require('./SyncedSession').SyncedSession;


// Implementation -------------------------------------------------------------
var Session = Class(function(server, config) {

    is.assert(is.Class(server));
    is.assert(is.Object(config));
    is.assert(is.Integer(config.tickRate));
    is.assert(is.Integer(config.tickBuffer));

    this._token = is.uniqueToken();
    this._server = server;

    this._owner = null;
    this._players = new TypedList(Player);
    this._playerId = 0;

    this._isStarted = false;

    Base(this);
    SyncedSession(this);

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

        this._players.each(function(player) {
            player.destroy();
        });

        this._server.removeSession(this);

        this.log('Closed');
        Base.destroy(this);

    },


    // Player Management ------------------------------------------------------
    addPlayer: function(remote) {

        // TODO create player in server level
        is.assert(Class.is(remote)); // TODO move this somehwat out here

        var player = new Player(this, remote, ++this._playerId);
        is.assert(this._players.add(player));

        this.broadcast(Net.Session.Player.Joined, player.toNetwork());
        this.broadcast(Net.Session.Update, this.toNetwork());
        this._server.updateSessions();

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
        this._server.updateSessions();

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
        is.assert(!this._owner);
        is.assert(Class.is(owner, Player));
        this.log('Owner set to', owner);
        owner.setReady(true);
        return (this._owner = owner);
    },

    isOwnedBy: function(owner) {
        is.assert(Class.is(owner, Player));
        return this._owner === owner;
    },

    getOwner: function() {
        return this._owner;
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
            owner: this._owner ? this._owner.toNetwork(false) : null,
            playerCount: this._players.length
        };
    },

    toString: function() {
        return 'Session';
    }

});

exports.Session = Session;

