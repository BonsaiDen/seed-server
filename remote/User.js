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

        if (type === Net.Login.Request) {

            var error = this.onLogin(data, id);
            if (error !== true) {
                this.error(error, id);
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
            this.log('Login Error: Client Version');
            return Net.Login.Error.ClientVersion;

        // Game
        } else if (!gameIdentifier.length || gameVersion <= 0) {
            this.log('Login Error: Game');
            return Net.Login.Error.InvalidGame;

        // Verify username
        } else if(!/^[0-9a-z_$]{3,16}$/i.test(username)) {
            this.log('Login Error: Username');
            return Net.Login.Error.InvalidUsername;


        // Verify Authentication
        } else if (!auth.length && token.length !== 40) {
            this.log('Login Error: Invalid Authentication');
            return Net.Login.Error.InvalidAuth;

        // Authenticate via the server's auth manager
        } else {

            this.log('Login ', clientVersion, '/', gameIdentifier, '@', gameVersion);

            this._user.gameVersion = gameVersion;
            this._user.gameIdentifier = gameIdentifier;

            if (token.length === 40) {

                var login = this.getServer().authenticateViaToken(token, username);
                if (login) {
                    this._handleLogin(login, id);
                    return true;

                } else {
                    return Net.Login.Error.InvalidToken;
                }

            } else {
                this.getServer().authenticate(auth, username, function(login) {
                    this._handleLogin(login, id);

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
    _handleLogin: function(login, id) {

        if (login) {

            // Set up user data
            this._user.login = true;
            this._user.email = login.email;
            this._user.username = login.username;

            // Confirm to client
            this.send(Net.Login.Response, [
                this.getName(),
                this.getEmail(),
                login.token

            ], id);

            this.send(Net.Client.Ping, 0);
            this.getServer().sendSessionList(this);

            this.log('Login:', this.getName(), ' - ', this.getEmail());

        } else {
            this.log('Login Error: Invalid Authentication');
            this.error(Net.Login.Error.InvalidAuth, id);
            this.close('Invalid Persona');
        }

    }

});

exports.User = User;

