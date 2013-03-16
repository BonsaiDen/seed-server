// Node Dependencies ----------------------------------------------------------
var https = require('https'),
    querystring = require('querystring'),
    crypto = require('crypto');

// Seed Dependencies ----------------------------------------------------------
var Class = require('../lib/Class').Class,
    is = require('../lib/is').is,
    Base = require('../lib/Base').Base;


// Implementation -------------------------------------------------------------
var AuthPersona = Class(function(server, config) {

    is.assert(is.Class(server));
    is.assert(is.Object(config));
    is.assert(is.String(config.audience));

    var that = this;

    this._server = server;
    this._config = {
        provider: config.provider || 'verifier.login.persona.org',
        endpoint: config.endpoint || '/verify',
        audience: config.audience
    };

    this._map = {};
    this._interval = null;
    this._interval = setInterval(function() {

        for(var i in that._map) {
            if (that._map.hasOwnProperty(i)) {
                that._validatePersona(that._map[i]);
            }
        }

    }, AuthPersona.INTERVAL);

    Base(this);

}, Base, {

    $INTERVAL: 1000 * 60 * 30,
    $TIMEOUT: 1000 * 60 * 60,

    // Methods ----------------------------------------------------------------
    authenticate: function(auth, username, callback, context) {

        is.assert(is.String(auth));
        is.assert(is.String(username));
        is.assert(is.Function(callback));
        is.assert(is.Object(context));

        if (auth.length && username.length) {
            this.info('Authenticating "%s" via persona...', username);
            this._verifyPersona(auth, username, callback, context);

        } else {
            this.error('Invalid Assertion:', auth);
            callback.call(context, null);
        }

    },

    authenticateViaToken: function(token, username, callback, context) {

        var inUse = null,
            login = null;

        if (is.String(token) && token.length === 40
            && is.String(username) && username.length) {

            var p = this._getPersonaForToken(token);

            // Check if the identifier is already in use
            if (p && this._server.getUserByIdentifier(p.identifier)) {
                this.error('Account alreay in use:', p.identifier);
                inUse = true;

            // If it matches, remove the old token and issue a new one
            } else if (p && p.username === username) {
                this.ok('Valid Token for:', p.username, p.identifier);
                this._removePersona(token);
                login = this._addPersona(p.username, p.identifier, p.expires);

            } else {
                this.warning('Invalid Username or Token:', username, token);
            }

        } else {
            this.error('Invalid Token:', token);
        }

        callback.call(context, login, inUse);

    },

    destroy: function() {

        for(var i in this._map) {
            if (this._map.hasOwnProperty(i)) {
                delete this._map[i];
            }
        }

        clearInterval(this._interval);
        this._interval = null;

        Base.destroy(this);

    },


    // Helpers ----------------------------------------------------------------
    toString: function() {
        return 'Persona Auth';
    },


    // Persona Management -----------------------------------------------------
    _addPersona: function(username, identifier, expires) {

        is.assert(is.String(username));
        is.assert(is.String(identifier));
        is.assert(is.Number(expires));

        var token = crypto.createHash('sha1');
        token.update(is.uniqueToken());
        token.update(username);
        token.update(identifier);
        token.update('' + Date.now());
        token = token.digest('hex');

        this.info('Added Persona:', username, identifier);
        this._map[token] = {
            expires: expires,
            username: username,
            identifier: identifier,
            token: token
        };

        return this._map[token];

    },

    _removePersona: function(token) {

        is.assert(is.String(token));
        if (this._map.hasOwnProperty(token)) {

            var persona = this._map[token];
            this.info('Remove Persona:', persona.username, persona.identifier);
            delete this._map[token];

            return true;

        } else {
            return false;
        }

    },


    // Getter / Setter --------------------------------------------------------
    _verifyPersona: function(assertion, username, callback, context) {

        var that = this,
            audience = this._config.audience,
            provider = this._config.provider,
            endpoint = this._config.endpoint;

        this.info('Verifying Persona from "%s" against "%s%s"', audience, provider, endpoint);


        // Verfify against the persona provider -------------------------------
        var req = https.request({
            host: provider,
            path: endpoint,
            method: 'POST'

        }, function(res) {

            var body = '';
            res.on('data', function(chunk) {
                body += chunk;

            }).on('end', function() {

                var response = {};
                try {
                    response = JSON.parse(body);
                    if (response.status !== 'okay' || response.audience !== audience) {
                        response.email = null;
                    }

                } catch(e) {
                    response.email = null;
                }

                var result = that._checkPersona(username, response);
                callback.call(context, result.login, result.inUse);

            });
        });

        var data = querystring.stringify({
            assertion: assertion,
            audience: audience
        });

        req.setHeader('Content-Type', 'application/x-www-form-urlencoded');
        req.setHeader('Content-Length', data.length);
        req.write(data);
        req.end();

    },

    _checkPersona: function(username, response) {

        var inUse = false,
            login = null;

        if (!response.email) {
            this.error('Verification for "%s" failed: %s', username, response.reason);
            response = null;

        } else if (this._server.getUserByIdentifier(response.identifier)) {
            inUse = true;

        } else {
            this.ok('Verification for "%s" successful', username);
            login = this._addPersona(username, response.email, response.expires);
        }

        return {
            login: login,
            inUse: inUse
        };

    },

    _getPersonaForToken: function(token) {

        is.assert(is.String(token));
        if (this._validatePersona(token)) {
            return this._map[token];

        } else {
            return null;
        }

    },

    _validatePersona: function(token) {

        if (this._map.hasOwnProperty(token)) {

            var persona = this._map[token],
                passed = Date.now() - persona.time;

            if (passed > AuthPersona.TIMEOUT || Date.now() > persona.expires) {
                this.info('Persona expired:', persona.username, persona.email);
                this._removePersona(token);
                return false;

            } else {
                return true;
            }

        } else {
            return false;
        }

    }

});

exports.Auth = AuthPersona;

