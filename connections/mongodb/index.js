'use strict';
// https://docs.mongodb.com/manual/reference/connection-string/
module.exports = (connection) => {
    connection.authDb = connection.authDb || connection.dbName ;

    let credentials;
    if (connection.db.user && connection.db.pass) {
        credentials = `${connection.db.user}:${connection.db.pass}@`;
    } else {
        credentials = '';
    }

    let hosts = [];
    if (connection.db.hosts) {
        connection.db.hosts.forEach((host) => {
            if (host.hostname && host.port) {
                hosts.push(`${host.hostname}:${host.port}`);
            }
        });
    }

    let instances;
    if (hosts.length > 0) {
        instances = `${hosts.join(',')}/`;
    } else {
        instances = 'localhost:27017/';
    }

    connection.uri = `mongodb://${credentials}${instances}${connection.authDb}`;

    return connection;
};
