// Seed Dependencies ----------------------------------------------------------
var Class = require('../lib/Class').Class,
    is = require('../lib/is').is,
    Net = require('../lib/Network').Network;


// Implementation -------------------------------------------------------------
var User = Class(function() {

    this._user = {
        clientVersion: null,
        gameVersion: null,
        gameIdentifier: null,
        username: null,
        identifier: null,
        login: false
    };

}, {


    // Methods ----------------------------------------------------------------
    onMessage: function(type, data) {
        return !this._user.login;
    },

    onAction: function(type, data, id) {

        if (this._user.login) {
            return false;
        }

        if (type === Net.Login.Request) {

            var error = this.onLogin(data, id);
            if (error !== true) {
                this.sendError(error, id);
                this.close('Login Error');
            }

        } else {
            this.close('Invalid Login');
        }

        return true;

    },

    onLogin: function(data, id) {

        var valid = true;
        if (data.length !== 5 && data.length !== 6) {
            return Net.Login.Error.RequestFormat;
        }

        // TODO send requirements to client and set up the form accordingly
        var clientVersion = is.Number(data[0]) ? data[0] : -1,
            gameIdentifier = is.String(data[1]) ? data[1].trim() : '',
            gameVersion = is.Number(data[2]) ? data[2] : -1,
            username = is.String(data[3]) ? data[3].trim() : '',
            auth = is.String(data[4]) ? data[4].trim() : '',
            token = is.String(data[5]) ? data[5].trim() : '';

        // Verify client version
        if (clientVersion !== this.getServer().getVersion()) {
            this.sendError('Login Error: Client Version');
            return Net.Login.Error.ClientVersion;

        // Game
        } else if (!gameIdentifier.length || gameVersion <= 0) {
            this.sendError('Login Error: Game');
            return Net.Login.Error.InvalidGame;

        // Verify username
        // TODO share this format with the client or make it configurable for
        // the server / in the auth manager
        } else if(!/^[0-9a-z_$]{3,16}$/i.test(username)) {
            this.sendError('Login Error: Username');
            return Net.Login.Error.InvalidUsername;


        // Verify Authentication
        } else if (!auth.length && token.length !== 40) {
            this.sendError('Login Error: Invalid Authentication');
            return Net.Login.Error.InvalidAuth;

        // Authenticate via the server's auth manager
        } else {

            this.info('Login ', clientVersion, '/', gameIdentifier, '@', gameVersion);

            this._user.gameVersion = gameVersion;
            this._user.gameIdentifier = gameIdentifier;

            if (token.length) {
                this.getServer().authenticateViaToken(token, username, function(login, inUse) {
                    this._handleLogin(login, id, inUse);

                }, this);

            } else {
                this.getServer().authenticate(auth, username, function(login, inUse) {
                    this._handleLogin(login, id, inUse);

                }, this);
            }

            return true;

        }

    },


    // Getters / Setters ------------------------------------------------------
    getName: function() {
        return this._user.username;
    },

    getIdentifier: function() {
        return this._user.identifier;
    },


    // Helpers ----------------------------------------------------------------
    toString: function() {
        return '#' + this.getName();
    },


    // Internals --------------------------------------------------------------
    _handleLogin: function(login, id, inUse) {

        if (inUse) {
            this.error('Login Error: Account "%s" already in use', login.identifier);
            this.sendError(Net.Login.Error.AccountInUse, id);
            this.close('Account in use');

        } else if (login) {

            // Set up user data
            this._user.login = true;
            this._user.identifier = login.identifier;
            this._user.username = login.username;

            // Confirm to client
            this.send(Net.Login.Response, [
                this.getName(),
                this.getIdentifier(),
                login.token

            ], id);

            this.send(Net.Client.Ping, 0);
            this.getServer().sendSessionList(this);

            this.ok('Login:', this.getName(), ' - ', this.getIdentifier());

        } else {
            this.error('Login Error: Invalid Authentication');
            this.sendError(Net.Login.Error.InvalidAuth, id);
            this.close('Invalid Login');
        }

    }

});

exports.User = User;

