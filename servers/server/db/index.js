'use strict';
// dynamic db connection based on host connector, meaning that different database types can be used with their choosen drivers
class DB {
    constructor(connection) {
        this.connection = connection;
    }
    connect = async () => await require(`./connectors/${this.connection.connector}`)(this.connection);
}

module.exports = DB;
