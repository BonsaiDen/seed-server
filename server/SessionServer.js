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
        this.info('Removing session', session);
        is.assert(Class.is(session, Session));
        is.assert(this._session.list.remove(session));
        this.sendSessionList();
    },


    // Actions ----------------------------------------------------------------
    onRemoteAction: function(remote, type, data, id) {

        this.ok('REMOTE ACTION', Net.nameFromType(type), data, id);

        var player, session, tokenSession;
        tokenSession = this.getSessionFromToken(data);
        if (remote.isInSession()) {

            player = remote.getPlayer();
            session = player.getSession();

            // Actions on current session
            if (session) {

                if (tokenSession !== session) {
                    remote.sendError(Net.Session.Error.Invalid, id);

                } else if (type === Net.Session.Action.Ready) {
                    this.sessionReady(player, session, id);

                } else if (type === Net.Session.Action.NotReady) {
                    this.sessionNotReady(player, session, id);

                } else if (type === Net.Session.Action.Start) {
                    this.sessionStart(player, session, id);

                // TODO handle countdown cancel
                // TODO add config for countdown duration
                //} else if (type === Net.Session.Action.Cancel) {
                    //this.sessionCancel(player, session, id);

                } else if (type === Net.Session.Action.Leave) {
                    this.sessionLeave(player, session, id);

                } else if (type === Net.Session.Action.Pause) {
                    this.sessionPause(player, session, id);

                } else if (type === Net.Session.Action.Resume) {
                    this.sessionResume(player, session, id);

                } else if (type === Net.Session.Action.Close) {
                    this.sessionClose(player, session, id);
                }

            } else {
                remote.sendError(Net.Session.Error.NotFound, id);
            }

        // Actions on other sessions
        } else if (tokenSession) {
            this.log('Found session from token', tokenSession);
            if (type === Net.Session.Action.Join) {
                // TODO handle maximum amount of players per session
                this.sessionJoin(remote, tokenSession, id);
            }

        // New Sessions
        } else if (type === Net.Session.Action.Create) {
            this.sessionCreate(remote, data, id);

        // Invalid State
        } else {
            remote.sendError(Net.Session.Error.Invalid, id);
        }

    },


    // Session Management -----------------------------------------------------
    sessionCreate: function(remote, data, id) {

        // TODO handle client side custom data
        is.assert(Class.is(remote));

        var session = new Session(this, this._session.config, remote);
        is.assert(this._session.list.add(session));

        this.sendSessionList();

        this.log('Added session', session);

        remote.send(Net.Session.Response.Joined, session.toNetwork(), id);

    },

    sessionStart: function(player, session, id) {

        if (!session.isReady()) {
            player.sendError(Net.Session.Error.NotReady, id);

        } else if (session.isRunning()) {
            player.sendError(Net.Session.Error.Running, id);

        } else if (!session.isOwnedBy(player)) {
            player.sendError(Net.Session.Error.NotOwner, id);

        } else {
            session.start();
            player.send(Net.Session.Response.Started, session.toNetwork(), id);
        }

    },

    sessionJoin: function(remote, session, id) {

        if (session.isRunning()) {
            remote.sendError(Net.Session.Error.Running, id);

        } else  {
            session.addPlayer(session.createPlayerForRemote(remote));
            remote.send(Net.Session.Response.Joined, session.toNetwork(), id);
        }

    },

    sessionReady: function(player, session, id) {

        if (session.isOwnedBy(player)) {
            player.sendError(Net.Session.Error.Invalid, id);

        } else if (session.isRunning()) {
            player.sendError(Net.Session.Error.Running, id);

        } else if (player.isReady()) {
            player.sendError(Net.Session.Error.IsReady, id);

        } else {
            session.setPlayerReady(player, true);
            player.send(Net.Session.Response.Ready, session.toNetwork(), id);
        }

    },

    sessionNotReady: function(player, session, id) {

        if (session.isOwnedBy(player)) {
            player.sendError(Net.Session.Error.Invalid, id);

        } else if (session.isRunning()) {
            player.sendError(Net.Session.Error.Running, id);

        } else if (!player.isReady()) {
            player.sendError(Net.Session.Error.NotReady, id);

        } else {
            session.setPlayerReady(player, false);
            player.send(Net.Session.Response.NotReady, session.toNetwork(), id);
        }

    },

    sessionLeave: function(player, session, id) {

        if (session.isOwnedBy(player) && !session.isRunning()) {
            player.send(Net.Session.Response.Closed, session.toNetwork(), id);
            session.close();

        } else {
            player.send(Net.Session.Response.Left, session.toNetwork(), id);
            session.removePlayer(player);
        }

    },

    sessionPause: function(player, session, id) {

        if (!session.isRunning()) {
            player.sendError(Net.Session.Error.NotRunning, id);

        } else if (session.isPaused()) {
            player.sendError(Net.Session.Error.Paused, id);

        } else if (player.hasPaused()) {
            player.sendError(Net.Session.Error.Invalid, id);

        } else {
            session.pause(player);
            player.send(Net.Session.Response.Paused, session.toNetwork(), id);
        }

    },

    sessionResume: function(player, session, id) {

        if (!session.isRunning()) {
            player.sendError(Net.Session.Error.NotRunning, id);

        } else if (!session.isPaused()) {
            player.sendError(Net.Session.Error.NotPaused, id);

        } else if (!player.hasPaused()) {
            player.sendError(Net.Session.Error.Invalid, id);

        } else {
            session.resume(player);
            player.send(Net.Session.Response.Resumed, session.toNetwork(), id);
        }

    },

    sessionClose: function(player, session, id) {

        if (session.isRunning()) {
            player.sendError(Net.Session.Error.Running, id);

        } else if (!session.isOwnedBy(player)) {
            player.sendError(Net.Session.Error.NotOwner, id);

        } else {
            player.send(Net.Session.Response.Closed, session.toNetwork(), id);
            session.close();
        }

    },


    // Getter / Setter --------------------------------------------------------
    getSessionFromToken: function(token) {
        return this._session.list.single(function(session) {
            return session.getToken() === token;
        });
    }

});

exports.SessionServer = SessionServer;

