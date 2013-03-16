// Node Dependencies ----------------------------------------------------------
var https = require('https'),
    querystring = require('querystring');

// Seed Dependencies ----------------------------------------------------------
var Class = require('../lib/Class').Class,
    is = require('../lib/is').is,
    Auth = require('./Auth').Auth,
    Net = require('../lib/Network').Network;


// Implementation -------------------------------------------------------------
var AuthPersona = Class(function(server, config) {

    Auth(this, server);

    is.assert(is.Object(config));
    is.assert(is.String(config.audience));

    this._config = {
        provider: config.provider || 'verifier.login.persona.org',
        endpoint: config.endpoint || '/verify',
        audience: config.audience
    };

}, Auth, {

    // Methods ----------------------------------------------------------------
    login: function(req, callback, context) {

        is.assert(is.String(req.username));
        is.assert(is.String(req.assertion));
        is.assert(is.Function(callback));
        is.assert(is.Object(context));

        var username = req.username,
            assertion = req.assertion;

        if (!this.isValidUsername(username)) {
            this.error('Invalid Username "%s"', username);
            callback.call(context, null);

        } else if (!this.isValidAssertion(assertion)) {
            this.error('Invalid Assertion:', assertion);
            callback.call(context, null);

        } else {
            this.info('Authenticating "%s" via persona...', username);
            this._verifyPersona(assertion, username, callback, context);
        }

    },


    // Getter / Setter --------------------------------------------------------
    isValidRequest: function(req) {

        if (req.length !== 6) {
            return Net.Login.Error.RequestFormat;

        } else {

            // Handle additional paramater for persona assertion
            var request = Auth.isValidRequest(this, req);
            if (is.Object(request)) {

                var assertion = is.String(req[5]) ? req[5].trim() : '';
                if (!request.token && !this.isValidAssertion(assertion)) {
                    return Net.Login.Error.InvalidData;

                } else {
                    request.assertion = assertion;
                }

            }

            return request;

        }

    },

    isValidAssertion: function(assertion) {
        // TODO make more exact
        return is.String(assertion) && assertion.length > 10;
    },

    getName: function() {
        return 'persona';
    },


    // Persona Management -----------------------------------------------------
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
            this.error('Account "%s" already in use.', username);
            inUse = true;

        } else {
            this.ok('Verification for "%s" successful', username);
            login = this.issueToken(username, response.email, response.expires);
        }

        return {
            login: login,
            inUse: inUse
        };

    },


    // Helpers ----------------------------------------------------------------
    toString: function() {
        return 'Persona Auth';
    }

});

exports.Auth = AuthPersona;

