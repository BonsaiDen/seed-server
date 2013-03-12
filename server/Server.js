// Seed Dependencies ----------------------------------------------------------
var Class = require('../lib/Class').Class,
    TypedList = require('../lib/TypedList').TypedList,
    is = require('../lib/is').is,
    lithium = require('../lib/lithium'),
    Base = require('../lib/Base').Base,
    Remote = require('../remote/Remote').Remote,
    SessionServer = require('./SessionServer').SessionServer,
    PersonaServer = require('./PersonaServer').PersonaServer;


// Implementation -------------------------------------------------------------
var Server = Class(function(config) {

    is.assert(is.Object(config));
    is.assert(is.Object(config.session));

    this._isRunning = false;
    this._port = null;
    this._host = null;
    this._interface = null;
    this._remotes = new TypedList(Remote);

    Base(this);
    PersonaServer(this);
    SessionServer(this, config.session);

}, Base, PersonaServer, SessionServer, {

    // Methods ----------------------------------------------------------------
    listen: function(port, host) {

        is.assert(is.Integer(port));
        is.assert(is.String(host));

        if (!this.isRunning()) {

            this.log('Starting...');

            // Internals
            this._port = port;
            this._host = host;
            this._isRunning = true;

            this._interface = new lithium.Server(null, JSON.stringify, JSON.parse);
            this._interface.on('connection', this.addRemote.bind(this));
            this._interface.listen(port, host);

            // Sub
            PersonaServer.start(this);

            this.log('Started');

            return true;

        } else {
            return false;
        }

    },

    stop: function() {

        if (this.isRunning()) {

            this.log('Stopping...');

            // Sub
            PersonaServer.stop(this);
            SessionServer.stop(this);

            // Internals
            this._remotes.each(function(remote) {
                remote.close();
            });
            is.assert(this._remotes.length === 0);

            this._port = null;
            this._host = null;
            this._isRunning = false;

            this._interface.unbind('connection', this);
            this._interface.close();
            this._interface = null;

            this.log('Stopped');

            return true;

        } else {
            return false;
        }

    },


    // Remotes ----------------------------------------------------------------

    // TODO make private again?
    addRemote: function(socket) {
        this._remotes.add(new Remote(this, socket));
    },

    removeRemote: function(remote) {
        is.assert(Class.is(remote, Remote));
        is.assert(this._remotes.remove(remote));
    },


    // Getter / Setter --------------------------------------------------------
    getVersion: function() {
        return 0.1;
    },

    getHost: function() {
        return this._host;
    },

    isRunning: function() {
        return this._isRunning;
    },


    // Helpers ----------------------------------------------------------------
    toString: function() {
        var c = this.isRunning() ? this._host + ':' + this._port : 'not listening';
        return 'Server (' + c + ')';
    }

});

exports.Server = Server;

