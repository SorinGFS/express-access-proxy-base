'use strict';
// dynamic db connection based on host connector, meaning that different database types with their own drivers can be used
class DB {
    constructor(connection) {
        this.connection = connection;
    }
    async connect() {
        await require(`./connectors/${this.connection.connector}`)(this.connection).then((connected) => Object.assign(this, connected));
    }
}

module.exports = DB;
