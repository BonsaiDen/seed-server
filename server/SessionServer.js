// Seed Dependencies ----------------------------------------------------------
var Class = require('../lib/Class').Class,
    TypedList = require('../lib/TypedList').TypedList,
    is = require('../lib/is').is,
    Net = require('../lib/Network').Network,
    Session = require('../session/Session').Session,
    Action = require('./SessionAction').Action;


// Implementation -------------------------------------------------------------
var SessionServer = Class(function(config) {

    is.assert(is.Object(config));
    is.assert(is.Integer(config.tickRate));
    is.assert(is.Integer(config.tickBuffer));

    this._session = {
        config: {
            rate: config.tickRate,
            buffer: config.tickBuffer
        },
        list: null
    };

}, {

    // Methods ----------------------------------------------------------------
    init: function() {
        this._session.list = new TypedList(Session);
    },

    shutdown: function() {
        this._session.list.each(function(session) {
            session.close();
        });

        this._session.list.destroy();
        this._session.list = null;
    },


    // Actions ----------------------------------------------------------------
    onRemoteAction: function(remote, type, data, id) {

        var sessionFromToken = this._sessionFromToken(data);

        // Actions on current session
        if (remote.isInSession()) {

            var player = remote.getPlayer(),
                session = player.getSession();

            if (session) {

                if (sessionFromToken !== session) {
                    remote.sendError(Net.Session.Error.Invalid, id);

                } else if (type === Net.Session.Action.Ready) {
                    Action.ready(session, player, id);

                } else if (type === Net.Session.Action.NotReady) {
                    Action.notReady(session, player, id);

                } else if (type === Net.Session.Action.Start) {
                    Action.start(session, player, id);

                // TODO handle countdown cancel
                // TODO add config for countdown duration
                //} else if (type === Net.Session.Action.Cancel) {
                    //this.sessionCancel(player, session, id);

                } else if (type === Net.Session.Action.Leave) {
                    Action.leave(session, player, id);

                } else if (type === Net.Session.Action.Pause) {
                    Action.pause(session, player, id);

                } else if (type === Net.Session.Action.Resume) {
                    Action.resume(session, player, id);

                } else if (type === Net.Session.Action.Close) {
                    Action.close(session, player, id);
                }

            } else {
                remote.sendError(Net.Session.Error.NotFound, id);
            }

        // Actions on other, existing sessions
        } else if (sessionFromToken) {

            if (type === Net.Session.Action.Join) {
                // TODO handle maximum amount of players per session
                Action.join(sessionFromToken, remote, id);

            } else {
                remote.sendError(Net.Session.Error.Invalid, id);
            }

        // Actions on new sessions
        } else if (type === Net.Session.Action.Create) {
            this.addSession(remote, data, id);

        } else {
            remote.sendError(Net.Session.Error.Invalid, id);
        }

    },


    // Session Management -----------------------------------------------------
    addSession: function(remote, data, id) {

        is.assert(Class.is(remote));
        is.assert(is.Object(data));

        // TODO handle client side custom data
        var session = new Session(this, this._session.config, remote);
        is.assert(this._session.list.add(session));

        this.updateSessions();
        remote.send(Net.Session.Response.Joined, session.toNetwork(), id);

        this.log('Added session', session);

    },

    removeSession: function(session) {
        is.assert(Class.is(session, Session));
        is.assert(this._session.list.remove(session));
        this.updateSessions();
        this.info('Removed session', session);
    },

    updateSessions: function(remote) {

        // List of session, ones which are running are ignored
        var list = this._session.list.filter(function(session) {
            return !session.isRunning();

        }).map(function(session) {
            return session.toNetwork();
        });

        // Send to a single remote
        if (remote && is.Function(remote.send)) {
            remote.send(Net.Session.Info.List, list);

        // Or broadcast to all logged in remotes on the server
        } else {
            this._remotes.each(function(remote) {
                if (remote.isLoggedIn()) {
                    remote.send(Net.Session.Info.List, list);
                }
            });
        }

    },


    // Getter / Setter --------------------------------------------------------
    _sessionFromToken: function(token) {
        return this._session.list.single(function(session) {
            return session.getToken() === token;
        });
    }

});

exports.SessionServer = SessionServer;

