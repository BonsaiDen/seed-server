// Seed Dependencies ----------------------------------------------------------
var Class = require('../lib/Class').Class,
    TypedList = require('../lib/TypedList').TypedList,
    is = require('../lib/is').is,
    Net = require('../lib/Network').Network,
    Session = require('../session/Session').Session;


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
        list: new TypedList(Session)
    };

}, {

    // Methods ----------------------------------------------------------------
    shutdown: function() {
        this._session.list.each(function(session) {
            session.close();
        });
        is.assert(this._session.list.length === 0);
    },

    // TODO make private?
    addSession: function(owner) {

        is.assert(Class.is(owner));

        var session = new Session(this, this._session.config, owner);
        is.assert(this._session.list.add(session));

        this.sendSessionList();

        this.log('Added session', session);

        return session;

    },

    sendSessionList: function(remote) {

        var list = this._session.list.filter(function(session) {
            return !session.isRunning();

        }).map(function(session) {
            return session.toNetwork();
        });

        // Send to a single remote
        if (remote && is.Function(remote.send)) {
            remote.send(Net.Session.Info.List, list);

        // Or broadcast
        } else {
            this._remotes.each(function(remote) {
                remote.send(Net.Session.Info.List, list);
            });
        }

    },

    removeSession: function(session) {
        this.log('Removed session', session);
        is.assert(Class.is(session, Session));
        is.assert(this._session.list.remove(session));
        this.sendSessionList();
    },


    // Actions ----------------------------------------------------------------
    onRemoteAction: function(remote, type, data, id) {

        var player, session, tokenSession;
        if (remote.isInSession()) {

            player = remote.getPlayer();
            session = player.getSession();
            console.log(type, data, !!session, !!player);
            tokenSession = this.getSessionFromToken(data);

            // Actions on current session
            if (session) {

                if (tokenSession !== session) {
                    remote.error(Net.Session.Error.Invalid, id);

                } else if (type === Net.Session.Action.Ready) {
                    this.sessionReady(player, session, id);

                } else if (type === Net.Session.Action.NotReady) {
                    this.sessionNotReady(player, session, id);

                } else if (type === Net.Session.Action.Start) {
                    this.sessionStart(player, session, id);

                } else if (type === Net.Session.Action.Leave) {
                    this.sessionLeave(player, session, id);

                } else if (type === Net.Session.Action.Close) {
                    this.sessionClose(player, session, id);
                }

            // Actions on other sessions
            } else if (tokenSession) {
                if (type === Net.Session.Action.Join) {
                    this.sessionStart(remote, tokenSession, id);
                }

            } else {
                remote.error(Net.Session.Error.NotFound, id);
            }

        // New Sessions
        } else if (type === Net.Session.Action.Create) {
            this.sessionCreate(remote, data, id);

        // Invalid State
        } else {
            remote.error(Net.Session.Error.Invalid, id);
        }

    },


    // Session Management -----------------------------------------------------
    sessionCreate: function(remote, data, id) {
        var session = this.addSession(remote);
        remote.send(Net.Session.Response.Joined, session.toNetwork(), id);
    },

    sessionStart: function(player, session, id) {

        if (!session.isReady()) {
            player.error(Net.Session.Error.NotReady, id);

        } else if (session.isRunning()) {
            player.error(Net.Session.Error.Running, id);

        } else if (!session.isOwnedBy(player)) {
            player.error(Net.Session.Error.NotOwner, id);

        } else {
            session.start();
            player.send(Net.Session.Response.Started, session.toNetwork(), id);
        }

    },

    sessionJoin: function(remote, session, id) {

        if (session.isRunning()) {
            remote.error(Net.Session.Error.Running, id);

        } else  {
            session.addPlayer(session.createPlayerForRemote(remote));
            remote.send(Net.Session.Response.Joined, session.toNetwork(), id);
        }

    },

    sessionReady: function(player, session, id) {

        if (session.isOwnedBy(player)) {
            player.error(Net.Session.Error.Invalid, id);

        } else if (session.isRunning()) {
            player.error(Net.Session.Error.Running, id);

        } else if (player.isReady()) {
            player.error(Net.Session.Error.IsReady, id);

        } else {
            player.setReady(true);
            player.send(Net.Session.Response.Ready, session.toNetwork(), id);
        }

    },

    sessionNotReady: function(player, session, id) {

        if (session.isOwnedBy(player)) {
            player.error(Net.Session.Error.Invalid, id);

        } else if (session.isRunning()) {
            player.error(Net.Session.Error.Running, id);

        } else if (!player.isReady()) {
            player.error(Net.Session.Error.NotReady, id);

        } else {
            player.setReady(false);
            player.send(Net.Session.Response.NotReady, session.toNetwork(), id);
        }

    },

    sessionLeave: function(player, session, id) {

        // TODO move to session? session.closeBy(player) ?
        if (session.isOwnedBy(player) && !session.isRunning()) {
            player.send(Net.Session.Response.Closed, session.toNetwork(), id);
            session.close();

        } else {
            // TODO remove from session instead? should that destroy the player?
            player.getPlayer().destroy();
            player.send(Net.Session.Response.Left, session.toNetwork(), id);
        }

    },

    sessionClose: function(player, session, id) {

        if (session.isRunning()) {
            player.error(Net.Session.Error.Running, id);

        } else if (!session.isOwnedBy(player)) {
            player.error(Net.Session.Error.NotOwner, id);

        } else {
            player.send(Net.Session.Response.Closed, session.toNetwork(), id);
            session.close();
        }

    },


    // Getter / Setter --------------------------------------------------------
    getSessionFromToken: function(token) {
        console.log(this._session.list, token);
        return this._session.list.single(function(session) {
            return session.getToken() === token;
        });
    }

});

exports.SessionServer = SessionServer;

