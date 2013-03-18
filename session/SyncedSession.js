// Seed Dependencies ----------------------------------------------------------
var Class = require('../lib/Class').Class,
    TypedList = require('../lib/TypedList').TypedList,
    is = require('../lib/is').is,
    Net = require('../lib/Network').Network,
    Player = require('./Player').Player;


// Implementation -------------------------------------------------------------
var SyncedSession = Class(function(config) {

    is.assert(is.Object(config));
    is.assert(is.Integer(config.rate));
    is.assert(is.Integer(config.buffer));

    this._synced = {
        running: false,
        actionId: 0,
        limit: 0,
        tick: 0,
        rate: config.rate,
        buffer: config.buffer,
        seed: 500000 + Math.floor((Math.random() * 1000000)),
        pausedPlayers: new TypedList(Player)
    };

}, {

    // Methods ----------------------------------------------------------------
    start: function() {

        this.log('Starting...');

        var synced = this._players.every(function(p) {
            return p.isSynced();
        });

        if (!this.isReady()) {
            this.warning('All players need to be ready');
            return false;

        } else if (!synced) {
            this.log('Waiting for all players to sync...');
            is.async(SyncedSession.start, this, 100);
            return true;

        } else if (!this._synced.running) {
            this.init();
            return true;

        } else {
            this.warning('Already Running');
            return false;
        }

    },

    init: function() {

        this._synced.running = true;
        this._synced.limit = 1;
        this._synced.tick = 0;
        this.broadcast(Net.Game.Start, function(player) {
            return this.getSessionInfo(player);
        });

        this.log('Initialized');

    },

    pause: function(player) {

        is.assert(Class.is(player, Player));
        if (!this.isPaused()) {

            is.assert(this._synced.pausedPlayers.length === 0);
            this._players.each(function(p) {
                this._synced.pausedPlayers.add(p);

            }, this);

            this.broadcast(Net.Game.Player.Paused, player.toNetwork());
            this.broadcast(Net.Game.Pause, this.toNetwork());

        }

    },

    resume: function(player) {

        is.assert(Class.is(player, Player));
        if (this.isPaused()) {

            if (this._synced.pausedPlayers.remove(player)) {

                this.broadcast(Net.Game.Player.Resumed, player.toNetwork());
                if (this._synced.pausedPlayers.length === 0) {
                    this.broadcast(Net.Game.Resume, this.toNetwork());
                }

            }

        }

    },


    // Player -----------------------------------------------------------------
    onPlayerMessage: function(player, type, data) {

        // TODO ignore when session is paused
        if (this.isPaused()) {
            this.warning('Session is paused, ignoring message from', player);

        } else if (type === Net.Game.Tick.Confirm) {

            if (is.Integer(data) && data > player.getTick()) {
                this.onPlayerTick(player, data);

            } else {
                this.warning('Invalid Tick Message from', player);
            }

        } else if (type === Net.Game.Action.Client) {

            // TODO check for array / object?
            if (is.NotNull(data)) {
                this.onPlayerAction(player, data);

            } else {
                this.warning('Invalid Action Message from', player);
            }

        } else {
            return false;
        }

    },

    onPlayerTick: function(player, tick) {

        is.assert(Class.is(player, Player));
        is.assert(is.Integer(tick));

        player.setTick(tick);

        var ticks = this._players.map(function(player) {
            return player.getTick();
        });

        var maxTick = Math.min.apply(Math, ticks);
        if (maxTick > this._synced.tick) {
            this._synced.tick = maxTick;
            this.broadcast(Net.Game.Tick.Limit, this.getTickLimit());
        }

    },

    onPlayerAction: function(from, action) {

        is.assert(is.Class(from, Player));
        is.assert(is.NotNull(action));

        this._players.each(function(to) {
            to.send(Net.Game.Action.Server,
                    this.getActionInfo(from, to, action));

        }, this);

        this._synced.actionId++;

    },


    // Getters / Setters ------------------------------------------------------
    isPaused: function() {
        return this._synced.pausedPlayers.length > 0;
    },

    getTickLimit: function() {
        return this._synced.tick + this._synced.buffer;
    },

    getSyncedTick: function() {
        return this._synced.tick;
    },

    getSessionInfo: function(player) {
        return {
            pid: player.getSessionId(),
            buffer: this._synced.buffer,
            rate: this._synced.rate,
            seed: this._synced.seed,
            tick: this._synced.limit
        };
    },

    getActionInfo: function(from, to, data) {
        return [

            // Unique Action id for local sorting
            this._synced.actionId,

            // The player ID of the sender
            from.getSessionId(),

            // tick at which to execute this action
            this.getTickLimit() + 1,

            data,

            // total ping from the sender to the receiver
            // (relative to the receiver)
            to.getPingTo(from),

            // total clock offset from the sender to the receiver
            // (relative to the receiver)
            to.getOffsetTo(from)

        ];
    }

});

exports.SyncedSession = SyncedSession;

