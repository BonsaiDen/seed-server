// Node Dependencies ----------------------------------------------------------
var crypto = require('crypto');

// Seed Dependencies ----------------------------------------------------------
var Class = require('../lib/Class').Class,
    is = require('../lib/is').is,
    Net = require('../lib/Network').Network,
    Base = require('../lib/Base').Base;


// Implementation -------------------------------------------------------------
var Auth = Class(function(server) {

    is.assert(is.Class(server));
    this._server = server;
    this._tokens = {};
    this._interval = setInterval(this._checkTokens.bind(this), Auth.INTERVAL);

    Base(this);

}, Base, {

    $INTERVAL: 1000 * 60 * 15,
    $TIMEOUT: 1000 * 60 * 60,
    $EXPIRES: 1000 * 60 * 60,


    // Methods ----------------------------------------------------------------
    loginFromRequest: function(req, callback, context) {

        is.assert(is.Object(req));
        is.assert(is.Function(callback));
        is.assert(is.Object(context));

        if (req.token) {
            this.loginWithToken(req, callback, context);

        } else {
            this.login(req, callback, context);
        }

    },

    login: function(req, callback, context) {

        is.assert(is.String(req.username));
        is.assert(is.Function(callback));
        is.assert(is.Object(context));

        var username = req.username;
        if (this.isValidUsername(username)) {

            var identifier = username.toLowerCase(),
                login = null,
                inUse = false;

            if (this._server.getUserByIdentifier(identifier)) {
                this.error('Account "%s" already in use.', username);
                inUse = true;

            } else {
                this.ok('Authenticated as "%s"', username);
                login = this.issueToken(username, identifier, Date.now() + Auth.EXPIRES);
            }

            callback.call(context, login, inUse);

        } else {
            this.error('Invalid Username "%s"', username);
            callback.call(context, null);
        }

    },

    loginWithToken: function(req, callback, context) {

        is.assert(is.String(req.username));
        is.assert(is.String(req.token));
        is.assert(is.Function(callback));
        is.assert(is.Object(context));

        var login = null,
            inUse = false,
            username = req.username,
            token = req.token;

        if (!this.isValidToken(token)) {
            this.error('Invalid Token:', token);

        } else if (!this.isValidUsername(username)) {
            this.error('Invalid Username:', username);

        } else {

            var t = this.getToken(token);
            if (!t) {
                this.warning('Token "%s" not found', token);

            } else if (t.username !== username) {
                this.warning('Username "%s" does not match Token "%s"', username, token);

            } else if (this._server.getUserByIdentifier(t.identifier)) {
                this.error('Account "%s" already in use.', t.username);
                inUse = true;

            } else {
                this.ok('Re-issueing token for "%s" (%s)', t.username, t.identifier);
                this.revokeToken(token);
                login = this.issueToken(t.username, t.identifier, t.expires);
            }

        }

        callback.call(context, login, inUse);

    },

    destroy: function() {

        for(var i in this._tokens) {
            if (this._tokens.hasOwnProperty(i)) {
                delete this._tokens[i];
            }
        }

        clearInterval(this._interval);
        this._interval = null;

        Base.destroy(this);

    },


    // Getter / Setter --------------------------------------------------------
    isValidRequest: function(req) {

        req = req || [];

        var clientVersion = is.Number(req[0]) ? req[0] : -1,
            gameIdentifier = is.String(req[1]) ? req[1].trim() : '',
            gameVersion = is.Number(req[2]) ? req[2] : -1,
            username = is.String(req[3]) ? req[3].trim() : '',
            token = is.String(req[4]) ? req[4].trim() : '';

        // Raw check
        this.info('Request:', req);
        if (req.length < 5) {
            return Net.Login.Error.RequestFormat;

        // Client Version against Server Version
        } else if (clientVersion !== this._server.getVersion()) {
            this.error('Client Version mismatch v%s', clientVersion);
            return Net.Login.Error.ClientVersion;

        // Game Identifcation
        } else if (!gameIdentifier.length || gameVersion <= 0) {
            this.error('Invalid Game "%s" @ v%s', gameIdentifier, gameVersion);
            return Net.Login.Error.InvalidGame;

        // Username
        } else if (!this.isValidUsername(username)) {
            this.error('Invalid Username "%s"', username);
            return Net.Login.Error.InvalidUsername;

        // Check token
        } else if (token.length > 0 && token.length !== 40) {
            this.error('Invalid Token "%s"', token);
            return Net.Login.Error.InvalidToken;

        } else {

            this.info(
                'Login Request for "%s" (Token: %s, Client @ v%s Game "%s"@ v%s',
                username,
                token,
                clientVersion,
                gameIdentifier,
                gameVersion
            );

            return {
                username: username,
                token: token.length ? token : null,
                client: {
                    version: clientVersion
                },
                game: {
                    version: gameVersion,
                    identifier: gameIdentifier
                }
            };
        }

    },

    isValidToken: function(token) {
        return is.String(token) && token.length === 40;
    },

    isValidUsername: function(username) {
        return is.String(username) && /^[0-9a-z_$]{3,16}$/i.test(username);
    },

    getToken: function(token) {

        is.assert(is.String(token));
        if (this.checkTokenTimeout(token)) {
            return this._tokens[token];

        } else {
            return null;
        }

    },

    getName: function() {
        return 'username';
    },

    issueToken: function(username, identifier, expires) {

        is.assert(is.String(username));
        is.assert(is.String(identifier));
        is.assert(is.Number(expires));

        // Create authentication token
        var token = crypto.createHash('sha1');
        token.update(is.uniqueToken());
        token.update(username);
        token.update(identifier);
        token.update('' + Date.now());
        token = token.digest('hex');

        var t = {
            expires: expires,
            username: username,
            identifier: identifier,
            token: token
        };

        this.info('Issued Token for "%s" (%s)', t.username, t.identifier);
        this._tokens[token] = t;
        return t;

    },

    revokeToken: function(token) {

        is.assert(is.String(token));
        if (this._tokens.hasOwnProperty(token)) {

            var t = this._tokens[token];
            this.info('Revoked Token for "%s" (%s)', t.username, t.identifier);
            delete this._tokens[token];

            return true;

        } else {
            return false;
        }

    },


    // Validation -------------------------------------------------------------
    checkTokenTimeout: function(token) {

        if (this._tokens.hasOwnProperty(token)) {

            var t = this._tokens[token];
            if (Date.now() > t.expires) {
                this.info('Token expired for "%s" (%s)', t.username, t.identifier);
                this.revokeToken(token);
                return false;

            } else {
                return true;
            }

        } else {
            return false;
        }

    },

    _checkTokens: function() {
        for(var i in this._tokens) {
            if (this._tokens.hasOwnProperty(i)) {
                this.checkTokenTimeout(this._tokens[i]);
            }
        }
    },


    // Helpers ----------------------------------------------------------------
    toString: function() {
        return 'Auth';
    }

});

exports.Auth = Auth;

