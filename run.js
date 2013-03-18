var Server = require('./server/Server').Server,
    PersonaAuth = require('./auth/Persona').Auth,
    BasicAuth = require('./auth/Auth').Auth,
    is = require('./lib/is').is,
    util = require('util');

require('longjohn');

var srv = new Server({

    session: {
        tickRate: 100,
        tickBuffer: 3
    },

    auth: {
        Manager: BasicAuth,
        config: {
            audience: 'localhost'
        }
    }

});

srv.listen(4444, 'localhost', true);

process.on('SIGINT', function() {
    is.error('============= RECEIVED SIGINT =============');
    srv.shutdown();
    process.exit();
});

