// Node Dependencies ----------------------------------------------------------
var https = require('https'),
    querystring = require('querystring');

// Seed Dependencies ----------------------------------------------------------
var Class = require('../lib/Class').Class,
    is = require('../lib/is').is;


// Implementation -------------------------------------------------------------
var PersonaServer = Class(function() {

    this._persona = {
        map: {},
        interval: null
    };

}, {

    $INTERVAL: 1000 * 60 * 60,


    // Methods ----------------------------------------------------------------
    start: function() {

        var that = this;
        this._persona.interval = setInterval(function() {

            for(var i in that._persona.map) {
                if (that._persona.map.hasOwnProperty(i)) {
                    that._personaValidate(that._persona.map[i]);
                }
            }

        }, PersonaServer.INTERVAL);

    },

    stop: function() {
        clearInterval(this._persona.interval);
        this._persona.interval = null;
    },


    // Persona Session Handling -----------------------------------------------
    addPersona: function(token, username, email) {

        is.assert(is.String(token));
        is.assert(is.String(username));
        is.assert(is.String(email));

        this.log('Added Persona:', username, email);
        this._persona.map[token] = {
            username: username,
            email: email
        };

    },

    verifyPersona: function(assertion, callback, context) {

        is.assert(is.String(assertion));
        is.assert(is.Function(callback));
        is.assert(is.Object(context));

        var req = https.request({
            host: 'verifier.login.persona.org',
            path: '/verify',
            method: 'POST'

        }, function(res) {

            // TODO update syntax for newer Node versions
            var body = '';
            res.on('data', function(chunk) {
                body += chunk;

            }).on('end', function() {

                var response;
                try {
                    response = JSON.parse(body);
                    if (response.status !== 'okay') {
                        response = null;
                    }

                } catch(e) {
                    response = null;
                }

                callback.call(context, response);

            });
        });

        // Build the request
        var data = querystring.stringify({
            assertion: assertion,
            audience: this.getHost()
        });

        req.setHeader('Content-Type', 'application/x-www-form-urlencoded');
        req.setHeader('Content-Length', data.length);
        req.write(data);
        req.end();

    },

    removePersona: function(token) {

        is.assert(is.String(token));
        if (this._persona.map.hasOwnProperty(token)) {

            var persona = this._persona.map[token];
            this.log('Remove Persona:', persona.username, persona.email);
            delete this._persona.map[token];

            return true;

        } else {
            return false;
        }

    },


    // Getter / Setter --------------------------------------------------------
    getPersona: function(token) {

        is.assert(is.String(token));
        if (this._personaValidate(token)) {
            return this._persona.map[token];

        } else {
            return null;
        }

    },


    // Internals --------------------------------------------------------------
    _personaValidate: function(token) {

        if (this._persona.map.hasOwnProperty(token)) {

            var persona = this._persona.map[token];
            if (Date.now() - persona.time > 60 * 60 * 1000) {
                this.log('Persona Timeout:', persona.username, persona.email);
                this.removePersona(token);
                return false;

            } else {
                return true;
            }

        } else {
            return false;
        }

    }

});

exports.PersonaServer = PersonaServer;

