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

    this._owner = null;
    this._players = new TypedList(Player);
    this._playerId = 0;

    this._isClosing = false;
    this._isStarted = false;

    Base(this);
    SyncedSession(this, config);

    this.setOwner(this.createPlayerForRemote(remote));
    this.addPlayer(this._owner);

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

            // Custom data
            if (is.Function(data)) {
                player.send(type, data.call(this, player));

            } else {
                player.send(type, data);
            }

        }, this);
    },

    close: function() {

        this._isClosing = true;
        this._players.each(function(player) {
            this.info('Destroying player');
            player.removeFromSession();

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

        // Order is imporant to avoid send a player twice to a remote
        player.send(Net.Client.Session, this.toNetwork());
        player.send(Net.Session.Info.Players, this._players.map(function(p) {
            return p.toNetwork(false);
        }));

        // TODO encapsulate all of this
        is.assert(this._players.add(player));
        this.broadcast(Net.Session.Player.Joined, player.toNetwork());
        this.broadcast(Net.Session.Info.Update, this.toNetwork());


        // TODO set not ready and evoke net code
        if (!this.isReady()) {
            this.broadcast(Net.Session.Info.NotReady, this.toNetwork());
        }

        // TODO Rename again???
        this._server.updateSessions();

        this.log('Player joined', player);

        return player;

    },

    removePlayer: function(player) {

        this.info('Removing Player', player);

        is.assert(Class.is(player, Player));
        is.assert(this._players.remove(player));

        player.send(Net.Client.Session, null);

        if (this.isRunning()) {
            player.send(Net.Game.Leave, player.toNetwork());
            this.broadcast(Net.Game.Player.Left, player.toNetwork());

        } else {
            this.broadcast(Net.Session.Player.Left, player.toNetwork());
        }

        if (this.isReady()) {
            this.broadcast(Net.Session.Info.Ready, this.toNetwork());
        }

        this.broadcast(Net.Session.Info.Update, this.toNetwork());
        this._server.updateSessions();

        this.info('Player left', player);



        // TODO last player will automatically win so send won status to him
        if (this._players.length === 1) {
            // TODO make sure that 2 or more players are needed to start
            // a session
        }

        if (player === this._owner) {
            this._owner = null;
        }

        // If session is emtpy close it on the next tick
        if (this._players.length === 0 && !this._isClosing) {

            this.info('Session is empty');

            this._isClosing = true;

            is.async(function() {
                this.close();

            }, this);
        }

        player.destroy();

    },

    // Player Interaction -----------------------------------------------------
    setOwner: function(owner) {
        is.assert(!this._owner);
        is.assert(Class.is(owner, Player));
        this.info('Owner set to', owner);
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

    setPlayerReady: function(player, mode) {

        is.assert(this._players.contains(player));
        player.setReady(mode);

        if (mode === true) {
            this.broadcast(Net.Session.Player.Ready, player.toNetwork(false));

        } else {
            this.broadcast(Net.Session.Player.NotReady, player.toNetwork(false));
        }

        if (this.isReady()) {
            this.broadcast(Net.Session.Info.Ready, this.toNetwork());
        }

    },

    containsPlayer: function(player) {
        is.assert(Class.is(player, Player));
        return this._players.contains(player);
    },


    // Getters / Setters ------------------------------------------------------
    getToken: function() {
        return this._token;
    },

    isRunning: function() {
        return this._isStarted;
    },

    isFull: function() {
        return false; // TODO implement
    },

    isReady: function() {
        return this._players.every(function(p) {
            return p.isReady();
        });
    },


    // Helpers ------------------------------------------------------------
    toNetwork: function() {
        return {
            token: this.getToken(),
            running: this.isRunning(),
            ready: this.isReady(), // TODO remove
            owner: this._owner ? this._owner.toNetwork(false) : null,
            playerCount: this._players.length
        };
    },

    toString: function() {
        return 'Session (' + this._players.length + ' players)';
    }

});

exports.Session = Session;

