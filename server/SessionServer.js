// Seed Dependencies ----------------------------------------------------------
var Class = require('../lib/Class').Class,
    TypedList = require('../lib/TypedList').TypedList,
    is = require('../lib/is').is,
    Network = require('../lib/Network').Network,
    Session = require('../session/Session').Session;


// Implementation -------------------------------------------------------------
var SessionServer = Class(function(config) {

    is.Signature(is.Object(null, {
        tickRate: is.Integer(),
        tickBuffer: is.Integer()
    }));

    this._session = {
        config: {
            rate: config.tickRate,
            buffer: config.tickBuffer
        },
        list: new TypedList(Session)
    };

}, {

    // Methods ----------------------------------------------------------------
    stop: function() {
        this._sessions.each(function(session) {
            session.close();
        });
        is.assert(this._session.list.length === 0);
    },

    // TODO make private?
    addSession: function(owner) {

        is.assert(Class.is(owner));

        var session = new Session(this, this._sessionConfig);
        is.assert(this._sessions.add(session));

        session.setOwner(session.addPlayer(owner));
        this.updateSessions();
        return session;

    },

    updateSessions: function() {

        var list = this._sessions.map(function(session) {
            return session.toNetwork();
        });

        this._remotes.each(function(remote) {
            remote.send(Network.Event.Session.List, list, 0);
        });

    },

    removeSession: function(session) {
        is.assert(Class.is(session, Session));
        is.assert(this._sessions.remove(session));
        this.updateSessions();
    },


    // Actions ----------------------------------------------------------------
    onRemoteAction: function(remote, type, data, id) {

        var player, session, tokenSession;
        if (remote.isInSession()) {

            player = remote.getPlayer();
            session = player.getSession();
            tokenSession = this.getSessionFromToken(data);

            // Actions on current session
            if (session) {

                if (tokenSession !== session) {
                    remote.error(Network.Error.Session.Invalid, id);

                } else if (type === Network.Event.Session.Ready) {
                    this.sessionReady(player, session, id);

                } else if (type === Network.Event.Session.NotReady) {
                    this.sessionNotReady(player, session, id);

                } else if (type === Network.Event.Session.Start) {
                    this.sessionStart(player, session, id);

                } else if (type === Network.Event.Session.Leave) {
                    this.sessionLeave(player, session, id);

                } else if (type === Network.Event.Session.Close) {
                    this.sessionClose(player, session, id);
                }

            // Actions on other sessions
            } else if (tokenSession) {
                if (type === Network.Event.Session.Join) {
                    this.sessionStart(remote, tokenSession, id);
                }

            } else {
                remote.error(Network.Error.Session.NotFound, id);
            }

        // New Sessions
        } else if (type === Network.Event.Session.Create) {
            this.sessionCreate(remote, data, id);

        // Invalid State
        } else {
            remote.error(Network.Error.Session.Invalid, id);
        }

    },


    // Session Management -----------------------------------------------------
    sessionCreate: function(remote, data, id) {
        var session = this.addSession(remote);
        remote.send(Network.Event.Session.Joined, session.toNetwork(), id);
    },

    sessionStart: function(player, session, id) {

        if (!session.isReady()) {
            player.error(Network.Error.Session.NotReady, id);

        } else if (session.isRunning()) {
            player.error(Network.Error.Session.Running, id);

        } else if (!session.isOwnedBy(player)) {
            player.error(Network.Error.Session.NotOwner, id);

        } else {
            session.start();
            player.send(Network.Event.Session.Started, session.toNetwork(), id);
        }

    },

    sessionJoin: function(remote, session, id) {

        if (session.isRunning()) {
            remote.error(Network.Error.Session.Running, id);

        } else  {
            session.addPlayer(remote);
            remote.send(Network.Event.Session.Joined, session.toNetwork(), id);
        }

    },

    sessionReady: function(player, session, id) {

        if (session.isOwnedBy(player)) {
            player.error(Network.Error.Session.Invalid, id);

        } else if (session.isRunning()) {
            player.error(Network.Error.Session.Running, id);

        } else if (player.isReady()) {
            player.error(Network.Error.Session.IsReady, id);

        } else {
            player.setReady(true);
            player.send(Network.Event.Session.Ready, session.toNetwork(), id);
        }

    },

    sessionNotReady: function(player, session, id) {

        if (session.isOwnedBy(player)) {
            player.error(Network.Error.Session.Invalid, id);

        } else if (session.isRunning()) {
            player.error(Network.Error.Session.Running, id);

        } else if (!player.isReady()) {
            player.error(Network.Error.Session.NotReady, id);

        } else {
            player.setReady(false);
            player.send(Network.Event.Session.NotReady, session.toNetwork(), id);
        }

    },

    sessionLeave: function(player, session, id) {

        // TODO move to session? session.closeBy(player) ?
        if (session.isOwnedBy(player) && !session.isRunning()) {
            player.send(Network.Event.Session.Closed, session.toNetwork(), id);
            session.close();

        } else {
            // TODO remove from session instead? should that destroy the player?
            player.getPlayer().destroy();
            player.send(Network.Event.Session.Left, session.toNetwork(), id);
        }

    },

    sessionClose: function(player, session, id) {

        if (session.isRunning()) {
            player.error(Network.Error.Session.Running, id);

        } else if (!session.isOwnedBy(player)) {
            player.error(Network.Error.Session.NotOwner, id);

        } else {
            player.send(Network.Event.Session.Closed, session.toNetwork(), id);
            session.close();
        }

    },


    // Getter / Setter --------------------------------------------------------
    getSessionFromToken: function(token) {
        return this._sessions.single(function(session) {
            return session.getToken() === token;
        });
    }

});

exports.SessionServer = SessionServer;

