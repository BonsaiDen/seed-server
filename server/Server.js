// Seed Dependencies ----------------------------------------------------------
var Class = require('../lib/Class').Class,
    TypedList = require('../lib/TypedList').TypedList,
    is = require('../lib/is').is,
    lithium = require('../lib/lithium'),
    Base = require('../lib/Base').Base,
    Remote = require('../remote/Remote').Remote,
    SessionServer = require('./SessionServer').SessionServer;


// Implementation -------------------------------------------------------------
var Server = Class(function(config) {

    is.assert(is.Object(config));
    is.assert(is.Object(config.session));
    is.assert(is.Object(config.auth));
    is.assert(is.Class(config.auth.Manager));

    this._config = config;
    this._isRunning = false;
    this._port = null;
    this._host = null;
    this._interface = null;
    this._remotes = new TypedList(Remote);
    this._authManager = null;

    Base(this);
    SessionServer(this, config.session);

}, Base, SessionServer, {

    // Methods ----------------------------------------------------------------
    listen: function(port, host) {

        is.assert(is.Integer(port));
        is.assert(is.String(host));

        if (!this.isRunning()) {

            this.log('Starting on %s:%s...', host, port);

            // Internals
            this._port = port;
            this._host = host;
            this._isRunning = true;

            this._interface = new lithium.Server(null, JSON.stringify, JSON.parse);
            this._interface.on('connection', this.addRemote.bind(this));
            this._interface.listen(port, host);

            // Authentication
            this._authManager = new this._config.auth.Manager(this, this._config.auth.config);

            this.log('Started');
            return true;

        } else {
            return false;
        }

    },

    shutdown: function() {

        if (this.isRunning()) {

            this.log('Shutting down...');

            // Sessions
            SessionServer.shutdown(this);

            // Authentication
            this._authManager.destroy();
            this._authManager = null;

            // Internals
            this._remotes.each(function(remote) {
                remote.shutdown();
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


    // Authentication Wrapper -------------------------------------------------
    authenticate: function(auth, username, callback, context) {
        this._authManager.authenticate.apply(this._authManager, arguments);
    },

    authenticateViaToken: function() {
        return this._authManager.authenticateViaToken.apply(this._authManager, arguments);
    },


    // Remotes ----------------------------------------------------------------

    // TODO make private again?
    addRemote: function(socket) {
        this.info('Adding Remote for', socket);
        this._remotes.add(new Remote(this, socket));
    },

    removeRemote: function(remote) {
        this.info('Removing Remote', remote);
        is.assert(Class.is(remote, Remote));
        is.assert(this._remotes.remove(remote));
    },


    // Getter / Setter --------------------------------------------------------
    getVersion: function() {
        return 0.1;
    },

    getPort: function() {
        return this._port;
    },

    getHost: function() {
        return this._host;
    },

    getUserByIdentifier: function(identifier) {
        return this._remotes.single(function(remote) {
           return remote.getIdentifier() === identifier;
        });
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

