// Seed Dependencies ----------------------------------------------------------
var Class = require('../lib/Class').Class,
    is = require('../lib/is').is,
    Net = require('../lib/Network').Network;


// Implementation -------------------------------------------------------------
var User = Class(function() {

    this._user = {
        client: null,
        game: null,
        username: null,
        identifier: null,
        isLoggedIn: false
    };

}, {


    // Methods ----------------------------------------------------------------
    onMessage: function(type, data) {
        return !this._user.isLoggedIn;
    },

    onAction: function(type, data, id) {

        if (this._user.isLoggedIn) {
            return false;
        }

        if (type === Net.Login.Request) {
            this.onLogin(data, id);

        } else {
            this.close('Invalid Login');
        }

        return true;

    },

    onLogin: function(data, id) {

        var auth = this.getServer().getAuhenticator(),
            req = auth.isValidRequest(data);

        if (!is.Object(req)) {
            this.error('Login Error:', Net.nameFromType(req));
            this.sendError(req, id);
            this.close('Login Error');

        } else {

            // Store game and client information
            this._user.game = req.game;
            this._user.client = req.client;

            auth.loginFromRequest(req, function(login, inUse) {
                this._handleLogin(login, id, inUse);

            }, this);

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
            this.sendError(Net.Login.Error.AccountInUse, id);
            this.close('Account in use');

        } else if (login) {

            this._user.isLoggedIn = true;
            this._user.username = login.username;
            this._user.identifier = login.identifier;

            this.send(Net.Login.Response, [
                this.getName(),
                this.getIdentifier(),
                login.token

            ], id);

            // Initiate client state
            this.send(Net.Client.Ping, 0);
            this.getServer().sendSessionList(this);

            this.ok('Logged in as "%s" (%s)', this.getName(), this.getIdentifier());

        } else {
            this.error('Invalid Login');
            this.sendError(Net.Login.Error.InvalidAuth, id);
            this.close('Invalid Login');
        }

    }

});

exports.User = User;

