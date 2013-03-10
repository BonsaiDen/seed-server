// Seed Dependencies ----------------------------------------------------------
var Class = require('../lib/Class').Class,
    TypedList = require('../lib/TypedList').TypedList,
    is = require('../lib/is').is,
    Net = require('../lib/Network').Network,
    Player = require('./Player').Player;


// Implementation -------------------------------------------------------------
var SyncedSession = Class(function(config) {

    is.Signature(is.Object(null, {
        rate: is.Integer(),
        buffer: is.Integer()
    }));

    this._synced = {
        running: false,
        actionId: 0,
        tick: 0,
        rate: config.rate,
        buffer: config.buffer,
        seed: 500000 + Math.floor((Math.random() * 1000000))
    };

}, {

    // Methods ----------------------------------------------------------------
    start: function() {

        this.log('Starting...');

        var synced = this._players.every(function(p) {
            return p.isSynced();
        });

        if (!this.isReady()) {
            this.log('All players need to be ready');
            return false;

        } else if (!synced) {
            this.log('Waiting for all players to sync...');
            setTimeout(SyncedSession.start.bind(this), 10);
            return true;

        } else if (!this._synced.running) {
            this.init();
            return true;

        } else {
            this.log('Already Running');
            return false;
        }

    },

    init: function() {
        this._synced.running = true;
        this._synced.tick = 1;
        this.broadcast(Net.Game.Start, this.getSessionInfo());
        this.broadcast(Net.Game.Tick.Limit, this.getTickLimit());
        this.log('Initialized');
    },


    // Player -----------------------------------------------------------------
    onPlayerTick: function(player, tick) {

        is.assert(Class.is(player, Player));
        is.assert(is.Integer(tick));

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
    isReady: function() {
        return this._players.every(function(p) {
            return p.isReady();
        });
    },

    getTickLimit: function() {
        return this._synced.tick + this._synced.buffer;
    },

    getSyncedTick: function() {
        return this._synced.tick;
    },

    getSessionInfo: function() {
        return {
            buffer: this._synced.buffer,
            rate: this._synced.rate,
            seed: this._synced.seed,
            players: this._players.map(function(player) {
                return player.toNetwork(false);
            })
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

