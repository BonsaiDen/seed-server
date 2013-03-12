// Seed Dependencies ----------------------------------------------------------
var Class = require('../lib/Class').Class,
    is = require('../lib/is').is,
    Base = require('../lib/Base').Base,
    Net = require('../lib/Network').Network,
    Syncable = require('./Syncable').Syncable,
    User = require('./User').User;


// Implementation -------------------------------------------------------------
var Remote = Class(function(server, socket) {

    is.assert(is.Class(server));
    is.assert(is.Object(socket));

    this._server = server;
    this._socket = socket;
    this._player = null;
    this._isConnected = true;

    this._socket.on('message', this.onMessage, this);
    this._socket.on('close', this.onClose, this);

    User(this);
    Syncable(this);
    Base(this);

}, Base, User, Syncable, {


    // Methods ----------------------------------------------------------------
    send: function(type, data, id) {

        is.assert(is.Integer(type));
        if (is.Integer(id)) {
            this._socket.send([type, data, id]);

        } else {
            this._socket.send([type, data]);
        }

    },

    error: function(type, id) {
        this._socket.send([Net.Err, type, id]);
    },

    close: function(reason) {

        if (this._isConnected) {

            this.log('Close:', reason);

            Syncable.close(this);

            this._isConnected = false;
            this._server.removeRemote(this);
            this._socket.unbind('message', this);
            this._socket.unbind('close', this);
            this._socket.close();

            // TODO really destroy player here?
            this._player && this.setPlayer(null);
            Base.destroy(this);

            return true;

        } else {
            return false;
        }

    },


    // Handlers ---------------------------------------------------------------
    onMessage: function(msg) {

        // Check raw message format
        var type, data, id;
        if (is.Array(msg)) {
            type = msg[0];
            data = msg[1];
            id = msg[2];

        } else {
            return false;
        }

        // TODO validate network types here
        if (!is.Integer(type)) {
            return false;

        // Messages
        } else if (msg.length === 2 && !!data) {

            if (User.onMessage(this, type, data)) {
                return true;

            } else if (Syncable.onMessage(this, type, data)) {
                return true;

            } else if (this._player) {
                if (this._player.onMessage(type, data) === false) {
                    this.log('Player message (un-handled):', type, data);
                }
            }

        // Client Actions
        } else if (msg.length === 3 && !!data && is.Integer(id)) {

            if (User.onAction(this, type, data, id)) {
                return true;

            } else if (this._server.onRemoteAction(this, type, data, id) === false) {
                this.log('Server message (un-handled):', type, data, id);
            }

        } else {
            this.close('Invalid Message');
        }

    },

    onClose: function(byRemote, reason) {
        if (byRemote) {
            this.log('Closed by Remote:', reason);

        } else {
            this.log('Closed by Server:', reason);
        }
        this.close(reason);
    },


    // Getters / Setters ------------------------------------------------------
    getPlayer: function() {
        return this._player;
    },

    setPlayer: function(player) {
        if (player === null) {
            is.assert(this._player);
            this._player = null;

        } else if (Class.is(player)) {
            is.assert(!this._player);
            this._player = player;
        }
    },

    getAddress: function() {
        return this._socket.id;
    },

    getServer: function() {
        return this._server;
    },

    isInSession: function() {
        return !!this._player;
    },


    // Helpers ----------------------------------------------------------------
    toString: function() {
        return 'Remote ' + User.toString(this)
                 + ' @ ' + this.getAddress()
                 + '(' + Syncable.toString(this) + ')';
    }

});

exports.Remote = Remote;

