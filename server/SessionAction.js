// Seed Dependencies ----------------------------------------------------------
var Net = require('../lib/Network').Network;


// Implementation -------------------------------------------------------------
var SessionAction = {

    join: function(session, remote, id) {

        if (session.isRunning()) {
            remote.sendError(Net.Session.Error.Running, id);

        } else if (session.isFull()) {
            remote.sendError(Net.Session.Error.Full, id);

        } else  {
            session.addPlayer(session.createPlayerForRemote(remote));
            remote.send(Net.Session.Response.Joined, session.toNetwork(), id);
        }

    },

    start: function(session, player, id) {

        // TODO handle not enough players
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

    ready: function(session, player, id) {

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

    notReady: function(session, player, id) {

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

    leave: function(session, player, id) {

        if (session.isOwnedBy(player) && !session.isRunning()) {
            player.send(Net.Session.Response.Closed, session.toNetwork(), id);
            session.close();

        } else {
            player.send(Net.Session.Response.Left, session.toNetwork(), id);
            session.removePlayer(player);
        }

    },

    pause: function(session, player, id) {

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

    resume: function(session, player, id) {

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

    close: function(session, player, id) {

        if (session.isRunning()) {
            player.sendError(Net.Session.Error.Running, id);

        } else if (!session.isOwnedBy(player)) {
            player.sendError(Net.Session.Error.NotOwner, id);

        } else {
            player.send(Net.Session.Response.Closed, session.toNetwork(), id);
            session.close();
        }

    }

};

exports.SessionAction = SessionAction;

