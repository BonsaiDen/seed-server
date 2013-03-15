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

    this._remote = remote;
    this._remote.setPlayer(this);

    Base(this);

    this.send(Net.Game.Player.Update, this.toNetwork(true));

}, Base, {

    // Methods ----------------------------------------------------------------
    send: function(type, data, id) {
        this._remote.send(type, data, id);
    },

    error: function(type, id) {
        this._remote.error(type, id);
    },

    onMessage: function(type, data) {

        if (type === Net.Game.Tick.Confirm) {

            // TODO handle error / reject this in else
            if (is.Integer(data) && data > this._tick) {
                this._tick = data;
                this._session.onPlayerTick(this, data);
            }

        } else if (type === Net.Game.Action.Client) {
            // TODO handle error / reject this in else
            if (is.NotNull(data)) {
                this._session.onPlayerAction(this, data);
            }

        } else {
            return false;
        }

    },

    destroy: function() {
        this._session.removePlayer(this);
        this._remote.setPlayer(null);
        Base.destroy(this);
    },


    // Getters / Setters ------------------------------------------------------
    getToken: function() {
        return this._token;
    },

    getAddress: function() {
        return this._remote.getAddress();
    },

    getName: function() {
        return this._remote.getName();
    },


    // Session
    isReady: function() {
        return this._isReady;
    },

    setReady: function(ready) {
        is.assert(is.Boolean(ready));
        this.log('Ready:', ready);
        this._isReady = ready;
    },

    getTick: function() {
        return this._tick;
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
        return 'Player #' + this.getId() + ' @ ' + this._remote.getAddress();
    }

});

exports.Player = Player;

