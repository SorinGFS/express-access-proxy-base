'use strict';
// https://docs.mongodb.com/manual/reference/connection-string/
module.exports = (connection) => {
    connection.authenticator.database = connection.authenticator.database || connection.database ;

    let credentials;
    if (connection.authenticator.username && connection.authenticator.password) {
        credentials = `${connection.authenticator.username}:${connection.authenticator.password}@`;
    } else {
        credentials = '';
    }

    let hosts = [];
    if (connection.hosts) {
        connection.hosts.forEach((host) => {
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

    connection.uri = `mongodb://${credentials}${instances}${connection.authenticator.database}`;

    return connection;
};
