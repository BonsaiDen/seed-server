// Dependencies ---------------------------------------------------------------
var Class = require('../lib/Class').Class,
    is = require('../lib/is').is,
    Base = require('../lib/Base').Base,
    Net = require('../lib/Network').Network;


// Implementation -------------------------------------------------------------
var Player = Class(function(session, remote, id) {

    is.assert(is.Class(session));
    is.assert(is.Class(remote));
    is.assert(is.Integer(id));

    this._token = is.uniqueToken();
    this._tick = 0;

    this._sessionId = id;
    this._session = session;
    this._isReady = false;

    this._name = remote.getName();
    this._address = remote.getAddress();

    this._remote = remote;
    this._remote.attachPlayer(this);

    Base(this);

    this.send(Net.Game.Player.Update, this.toNetwork(true));

}, Base, {

    // Methods ----------------------------------------------------------------
    send: function(type, data, id) {
        if (this._remote) {
            this._remote.send(type, data, id);

        } else {
            this.warning('Player not longer connected, ingoring send().');
        }
    },

    sendError: function(type, id) {
        if (this._remote) {
            this._remote.sendError(type, id);

        } else {
            this.warning('Player not longer connected, ingoring sendError().');
        }
    },

    onMessage: function(type, data) {
        if (!this._session) {
            this.warning('Player not longer in session, ignoring message');

        } else {
            return this._session.onPlayerMessage(this, type, data);
        }
    },

    removeFromSession: function() {
        is.assert(this._session);
        this._session.removePlayer(this);
    },

    destroy: function() {

        is.assert(!this._session.containsPlayer(this));
        this._session = null;
        this._remote.detachPlayer(this);
        Base.destroy(this);

    },


    // Getters / Setters ------------------------------------------------------
    getToken: function() {
        return this._token;
    },

    getAddress: function() {
        return this._address;
    },

    getName: function() {
        return this._name;
    },

    // Session
    isReady: function() {
        return this._isReady;
    },

    setReady: function(ready) {
        is.assert(is.Boolean(ready));
        this.info('Ready:', ready);
        this._isReady = ready;
    },

    setTick: function(tick) {
        is.assert(is.Integer(tick));
        this._tick = tick;
    },

    getTick: function() {
        return this._tick;
    },

    setSession: function(session) {
        is.assert(Class.is(session));
        this._session = session;
    },

    getSession: function() {
        return this._session;
    },

    getSessionId: function() {
        return this._sessionId;
    },


    // Network
    isSynced: function() {
        return this._remote.isSynced();
    },

    getPing: function() {
        return this._remote.getPing();
    },

    getPingTo: function(other) {

        is.assert(Class.is(other, Player));
        if (other === this) {
            return this.getPing();

        } else {
            return other.getPing() + this.getPing();
        }

    },

    getOffset: function() {
        return this._remote.getOffset();
    },

    getOffsetTo: function(other) {

        is.assert(Class.is(other, Player));
        if (other === this) {
            return 0;

        } else {
            return other.getOffset() - this.getOffset();
        }

    },


    // Helpers ----------------------------------------------------------------
    toNetwork: function(all) {
        return {
            id: this._sessionId,
            address: this.getAddress(),
            name: this.getName(),
            token: all ? this.getToken() : null
        };
    },

    toString: function() {
        return 'Player #' + this.getId() + ' @ ' + this._address;
    }

});

exports.Player = Player;

