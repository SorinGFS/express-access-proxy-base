'use strict';
// this returns the connection object used by dynamic model to connect
module.exports = (connection) => require(`./${connection.connector}`)(connection);
