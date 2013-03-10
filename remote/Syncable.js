// Seed Dependencies ----------------------------------------------------------
var Class = require('../lib/Class').Class,
    is = require('../lib/is').is,
    Network = require('../lib/Network').Network;


// Implementation -------------------------------------------------------------
var Syncable = Class(function() {

    this._sync = {
        sliding: false,
        rt: new Array(Syncable.PING_COUNT),
        clock: new Array(Syncable.PING_COUNT),
        tick: 0,
        ping: 0,
        clockOffset: 0
    };

}, {

    $PING_COUNT: 12,
    $PING_INTERVAL: 1000,
    $PING_MAX: 5000,


    // Methods ----------------------------------------------------------------
    onMessage: function(type, data) {

        if (type === Network.Event.Pong) {
            this.onSync(data[0], data[1]);
            return true;

        } else {
            return false;
        }

    },

    onSync: function(time, diff) {

        var sync = this._sync;

        // Drop pongs which extremely high latency
        if (diff > Syncable.PING_MAX) {
            this.send(Network.Event.Ping, time);

        } else {

            // Keep a sliding window of the roundtrips and clocks
            sync.rt[sync.tick] = diff;
            sync.clock[sync.tick] = [time, Date.now()];

            // Gather the initial values
            if (!sync.sliding && sync.tick < Syncable.PING_COUNT - 1) {
                this.send(Network.Event.Ping, time);

            // When the window is full calculate the
            } else {

                // Schedule the next periodic ping update
                this._syncPing(time, Syncable.PING_INTERVAL);

                // Calculate the average latency
                var ping = Math.round(this._syncAverage(sync.rt) * 0.5);

                // Calculate the average time offset to the client
                var offset = this._syncAverage(sync.clock.map(function(val) {
                    return (val[0] + ping) - val[1];
                }));

                // Ping and clock offset of the client
                sync.ping = ping;
                sync.clockOffset = offset;

                if (!sync.sliding) {
                    this.log('Synced');
                }

                // Transition to the sliding window for continues updates
                sync.sliding = true;

            }

            // Wrap tick for sliding window
            this._sync.tick++;
            if (this._sync.tick >= Syncable.PING_COUNT) {
                this._sync.tick = 0;
            }

        }

    },


    // Getters / Setters ------------------------------------------------------
    getPing: function() {
        return this._sync.ping;
    },

    getOffset: function() {
        return this._sync.clockOffset;
    },

    isSynced: function() {
        return this._sync.sliding;
    },


    // Helpers ----------------------------------------------------------------
    toString: function() {
        return this._sync.clockOffset
                + 'ms offset, '
                + this._sync.ping
                + 'ms ping';
    },


    // Internals --------------------------------------------------------------
    _syncPing: function(time, delay) {

        var that = this,
            offset = Date.now();

        setTimeout(function() {
            if (that._isConnected) {
                that.send(Network.Event.Ping, time + (Date.now() - offset));
            }

        }, delay);

    },

    _syncAverage: function(values) {

        var deviation = Math.abs(values.reduce(function(p, c) {
            return p + c;
        }));

        deviation /= values.length;

        var normals = values.filter(function(val) {
            return Math.abs(val - deviation) <= deviation * 2;
        });

        if (normals.length === 0) {
            return 0;
        }

        var average = normals.reduce(function(prev, next) {
            return prev + next;
        });

        return Math.round(average / normals.length);

    }

});

exports.Syncable = Syncable;

