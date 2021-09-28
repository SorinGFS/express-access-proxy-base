'use strict';
// https://docs.mongodb.com/drivers/node/v4.0/fundamentals/connection/
const { MongoClient } = require('mongodb');

async function connect({ uri, options }) {
    try {
        const client = new MongoClient(uri, options);
        await client.connect();
        return { client };
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

module.exports = connect;
