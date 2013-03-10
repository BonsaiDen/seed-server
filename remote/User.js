// Node Dependencies ----------------------------------------------------------
var crypto = require('crypto');


// Seed Dependencies ----------------------------------------------------------
var Class = require('../lib/Class').Class,
    is = require('../lib/is').is,
    Network = require('../lib/Network').Network;


// Implementation -------------------------------------------------------------
var User = Class(function() {

    this._user = {
        clientVersion: null,
        gameVersion: null,
        gameIdentifier: null,
        username: '',
        email: '',
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

        if (type === Network.Event.Login.Client) {

            if (this.onLogin(data, id) !== true) {
                this.error(Network.Error.Login, id);
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
            return Network.Error.Login.Format;
        }

        // TODO send requirements to client and set up the form accordingly
        var clientVersion = is.Number(data[0]) ? data[0] : -1,
            gameIdentifier = is.String(data[1]) ? data[1].trim() : '',
            gameVersion = is.Number(data[2]) ? data[2] : -1,
            username = is.String(data[3]) ? data[3].trim() : '',
            assertion = is.String(data[4]) ? data[4].trim() : '',
            token = is.String(data[5]) ? data[5].trim() : '';

        // Verify client version
        if (clientVersion !== this.getServer().getVersion()) {
            this.log('Login Error: Client Version');
            return Network.Error.Login.Version;

        // Verify username
        } else if(!/^[0-9a-z_$]{3,16}$/i.test(username)) {
            this.log('Login Error: Username');
            return Network.Error.Login.Persona;

        // Assertion
        } else if (!assertion.length && token.length !== 40) {
            this.log('Login Error: Assertion');
            return Network.Error.Login.Persona;

        // Game
        } else if (!gameIdentifier.length || gameVersion <= 0) {
            this.log('Login Error: Game');
            return Network.Error.Login.Game;

        } else {

            this._user.username = username;
            this._user.gameVersion = gameVersion;
            this._user.gameIdentifier = gameIdentifier;

            this.log('Login ', clientVersion, '/', gameIdentifier, '@', gameVersion);

            // Check whether we still have a persona session cached
            if (token.length === 40) {

                // Get token and remove it from cache
                // TODO simplify call
                var persona = this.getServer().getPersona(token);
                this.getServer().removePersona(token);

                // Check the username, it must match
                if (persona && persona.username === username) {
                    this.log('Login with Token...');
                    this._userPersona(persona, id);
                    return true;

                } else {
                    this.log('Login Error: Token');
                    return Network.Error.Login.Token;
                }

            } else {
                this.getServer().verifyPersona(assertion, function(response) {
                    this._userPersona(response, id);

                }, this);
                return true;
            }

        }

    },


    // Getters / Setters ------------------------------------------------------
    getName: function() {
        return this._user.username;
    },

    getEmail: function() {
        return this._user.email;
    },


    // Helpers ----------------------------------------------------------------
    toString: function() {
        return '#' + this.getName();
    },


    // Internals --------------------------------------------------------------
    _userPersona: function(response, id) {

        if (response) {

            this._user.login = true;
            this._user.email = response.email;

            // Create Persona Session
            var token = crypto.createHash('sha1');
            token.update(is.uniqueToken());
            token.update(this.getEmail());
            token.update(this.getName());
            token.update('' + Date.now());
            token = token.digest('hex');

            this.getServer().addPersona(token, this.getName(), this.getEmail());

            // Confirm to client
            this.send(Network.Event.Login.Server, [this.getName(), this.getEmail(), token], id);
            this.send(Network.Event.Ping, 0);

            this.log('Persona Login with', this.getEmail());

        } else {
            this.log('Login Error: Persona');
            this.error(Network.Error.Persona, id);
            this.close();
        }

    }

});

exports.User = User;

