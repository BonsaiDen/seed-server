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

        is.assert(is.Integer(type) && Net.isValidType(type));

        if (type !== Net.Client.Ping
            && type !== Net.Client.Sync
            && type !== Net.Game.Tick.Confirm
            && type !== Net.Game.Tick.Limit) {
            this.info('Send:', Net.nameFromType(type), data);
        }

        if (is.Integer(id)) {
            this._socket.send([type, data, id]);

        } else {
            this._socket.send([type, data]);
        }

    },

    sendError: function(type, id) {
        this._socket.send([Net.Error, type, id]);
    },

    shutdown: function() {
        if (this._isConnected) {
            this._socket.send([Net.Server.Shutdown, 0]);
            this.close('Server Shutdown');
        }
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

            if (this.isInSession()) {
                // TODO make this nicer?
                this._player.removeFromSession();
            }

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

        if (!is.Integer(type) || !Net.isValidType(type)) {
            this.warning('Invalid Network Type', +type);
            return false;

        // Messages
        } else if (msg.length === 2 && !!data) {

            //this.info('Received %s:', Net.nameFromType(type), data);

            if (User.onMessage(this, type, data)) {
                return true;

            } else if (Syncable.onMessage(this, type, data)) {
                return true;

            } else if (this._player) {
                if (this._player.onMessage(type, data) === false) {
                    this.warning('Player message (un-handled):', type, data);
                }
            }

        // Client Actions
        } else if (msg.length === 3 && !!data && is.Integer(id)) {

            //this.info('Received %s:', Net.nameFromType(type), data, id);

            if (User.onAction(this, type, data, id)) {
                return true;

            } else if (this._server.onRemoteAction(this, type, data, id) === false) {
                this.warning('Server message (un-handled):', type, data, id);
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

    attachPlayer: function(player) {
        is.assert(!this._player);
        is.assert(is.Class(player));

        this._player = player;
        this.info('Attached Player');
    },

    detachPlayer: function(player) {
        is.assert(this._player === player);
        this._player = null;
        this.info('De-tached Player');
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

