'use strict';
// model is connector specific, custom model is extending base model and is dbName specific
const DB = require('../../db');
const jsonSchema = require('./json-schema');
const orm = require('./orm');

// Many methods in the MongoDB driver will return a promise if the caller doesn't pass a callback function.
class Model extends DB {
    constructor(connection) {
        super(connection);
        Object.assign(this, jsonSchema, { orm });
        this.isConnected = false;
        this.collection = connection.namespace.split('.')[1];
    }
    async init() {
        if (!this.isConnected) {
            await this.connect()
                .then(() => (this.db = this.client.db(this.dbName)))
                .then(() => (this.db.collection = this.db.collection(this.collection)))
                .then(() => (this.isConnected = true));
        }
    }
    async close() {
        await this.client.close();
    }
    async command(command, options) {
        if (!this.isConnected) await this.init();
        return await this.db.command({ ...command }, { ...options });
    }
    async setCollectionOptions(collectionOptions, commandOptions) {
        if (!this.isConnected) await this.init();
        const command = { collMod: this.collection, ...collectionOptions };
        return await this.db.command({ ...command }, { ...commandOptions });
    }
    async indexes() {
        if (!this.isConnected) await this.init();
        return await this.db.command({ listIndexes: this.collection }).then((result) => result.cursor.firstBatch);
    }
    async createIndex(keys, options, commitQuorum) {
        if (!this.isConnected) await this.init();
        return await this.db.collection.createIndex({ ...keys }, { ...options }, commitQuorum);
    }
    async dropIndex(index) {
        if (!this.isConnected) await this.init();
        return await this.db.collection.dropIndex(index);
    }
    async validation() {
        if (!this.isConnected) await this.init();
        const collection = await this.db.listCollections({ name: this.collection }).toArray();
        return { validator: collection[0].options.validator, validationLevel: collection[0].options.validationLevel, validationAction: collection[0].options.validationAction };
    }
    async setValidation(validation, commandOptions) {
        if (!this.isConnected) await this.init();
        return await this.setCollectionOptions({ ...validation }, { ...commandOptions });
    }
    async info() {
        if (!this.isConnected) await this.init();
        const collection = await this.db.listCollections({ name: this.collection }).toArray();
        return { info: collection[0].info };
    }
    async count(filter) {
        if (!this.isConnected) await this.init();
        return { matchedCount: await this.db.collection.countDocuments({ ...filter }) };
    }
    async distinct(key, filter, commandOptions) {
        if (!this.isConnected) await this.init();
        return await this.db.collection.distinct(key, { ...filter }, { ...commandOptions });
    }
    async aggregate(pipeline, options) {
        if (!this.isConnected) await this.init();
        return await this.db.collection.aggregate([...pipeline], { ...options });
    }
    async bulkWrite(operations, options) {
        if (!this.isConnected) await this.init();
        return await this.db.collection.bulkWrite([...operations], { ...options });
    }
    async watch(pipeline, options) {
        if (!this.isConnected) await this.init();
        return await this.db.collection.watch([...pipeline], { ...options });
    }
    async findOne(filter, options) {
        if (!this.isConnected) await this.init();
        return await this.db.collection.findOne({ ...filter }, { ...options });
    }
    async find(filter, options) {
        if (!this.isConnected) await this.init();
        return await this.db.collection.find({ ...filter }, { ...options });
    }
    async insertOne(document, options) {
        if (!this.isConnected) await this.init();
        return await this.db.collection.insertOne({ ...document }, { ...options });
    }
    async insertMany(documents, options) {
        if (!this.isConnected) await this.init();
        return await this.db.collection.insertMany([...documents], { ...options });
    }
    async updateOne(filter, update, options) {
        if (options) delete options.upsert;
        if (!this.isConnected) await this.init();
        return await this.db.collection.updateOne({ ...filter }, { $set: { ...update } }, { ...options });
    }
    async updateMany(filter, update, options) {
        if (options) delete options.upsert;
        if (!this.isConnected) await this.init();
        return await this.db.collection.updateMany({ ...filter }, { $set: { ...update } }, { ...options });
    }
    async upsertOne(filter, update, options) {
        if (options) delete options.upsert;
        if (!this.isConnected) await this.init();
        return await this.db.collection.updateOne({ ...filter }, { $set: { ...update } }, { upsert: true, ...options });
    }
    async upsertMany(operations) {
        const operation = (args) => ({ updateMany: { filter: args[0], update: { $set: args[1] }, upsert: true } });
        for (let i = 0; i < operations.length; i++) {
            operations[i] = operation(operations[i]);
        }
        return await this.bulkWrite(operations);
    }
    async deleteOne(filter, options) {
        if (!this.isConnected) await this.init();
        return await this.db.collection.deleteOne({ ...filter }, { ...options });
    }
    async deleteMany(filter, options) {
        if (!this.isConnected) await this.init();
        return await this.db.collection.deleteMany({ ...filter }, { ...options });
    }
}

module.exports = Model;
