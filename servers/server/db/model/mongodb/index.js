'use strict';
// model is connector specific, custom model is extending base model and is database specific
const DB = require('../..');
const jsonSchema = require('./json-schema');
const orm = require('./orm');

// Many methods in the MongoDB driver will return a promise
class Model extends DB {
    // connect() method is connector specific and is inherited through dynamic DB model
    constructor(connection) {
        super(connection);
        Object.assign(this, jsonSchema, { orm });
        this.p = Promise.resolve();
    }
    // direct access to the driver methods
    getClient = async () => this.client || (await this.connect().then((result) => result.client));
    getDb = (db) => this.getClient().then((client) => client.db(db));
    getAdmin = () => this.getDb().then((db) => db.admin());
    getController = (controller, db) => this.getDb(db).then((db) => db.collection(controller));
    select = (table, fromDb) => this.getDb(fromDb).then((db) => db.collection(table)); // alias
    // interface methods to the driver
    exec() {
        return this._chain(this._exec, arguments);
    }
    _exec(fn, args) {
        this[fn].apply(this, args ? Array.prototype.slice.call(args) : undefined);
    }
    returnArg() {
        return this._chain(this._returnArg, arguments);
    }
    _returnArg() {
        return Array.prototype.slice.call(arguments)[0];
    }
    returnArgs() {
        return this._chain(this._returnArgs, arguments);
    }
    _returnArgs() {
        return Array.prototype.slice.call(arguments);
    }
    restClient() {
        return this._chain(this._init, arguments);
    }
    async _init(connection) {
        if (!this.isConnected || connection) {
            if (connection) this.connection = connection;
            Object.assign(this, await this.connect());
            this.isConnected = true;
        }
    }
    db() {
        return this._chain(this._initDb, arguments);
    }
    async _initDb(db, connection) {
        if (!this.isDbConnected || db) {
            if (db) this.connection.database = db;
            await this._init(connection);
            this._db = this.client.db(this.connection.database);
            this.isDbConnected = true;
        }
    }
    admin() {
        return this._chain(this._initAdmin, arguments);
    }
    async _initAdmin(db, connection) {
        if (!this.isAdminConnected || connection || db) {
            await this._init(connection);
            await this._initDb(db);
            this._db._admin = this._db.admin();
            this.isAdminConnected = true;
        }
    }
    controller() {
        return this._chain(this._initController, arguments);
    }
    async _initController(controller, db, connection) {
        if (!this.isControllerConnected || controller) {
            if (controller) this.connection.controller = controller;
            await this._init(connection);
            await this._initDb(db);
            this._db._collection = this._db.collection(this.connection.controller);
            this.isControllerConnected = true;
        }
    }
    // not in the restApi
    debug() {
        return this._chain(this._debug, arguments);
    }
    async _debug() {
        console.dir(this, { depth: false });
    }
    async close() {
        await this.client.close();
    }
    // not in the restApi
    command() {
        return this._chain(this._command, arguments);
    }
    async _command(command, options) {
        if (!this.isDbConnected) await this._initDb();
        return await this._db.command({ ...command }, { ...options });
    }
    // not in the restApi
    listDatabases() {
        return this._chain(this._listDatabases, arguments);
    }
    async _listDatabases(listDatabasesOptions) {
        if (!this.isAdminConnected) await this._initAdmin();
        return await this._db._admin.listDatabases({ ...listDatabasesOptions });
    }
    async listAuthorizedDatabases() {
        return await this.listDatabases({ nameOnly: true, authorizedDatabases: true }).then((obj) => [].concat(obj.databases.map((item) => item.name)));
    }
    dropDatabase() {
        return this._chain(this._dropDatabase, arguments);
    }
    async _dropDatabase(commandOperationOptions) {
        if (!this.isDbConnected) await this._initDb();
        return await this._db.dropDatabase({ ...commandOperationOptions });
    }
    addAdmin() {
        return this._chain(this._addAdmin, arguments);
    }
    async _addAdmin(username, password, addUserOptions) {
        if (!this.isAdminConnected) await this._initAdmin();
        return await this._db._admin.addUser(username, password, { ...addUserOptions });
    }
    removeAdmin() {
        return this._chain(this._removeAdmin, arguments);
    }
    async _removeAdmin(username, commandOperationOptions) {
        if (!this.isAdminConnected) await this._initAdmin();
        return await this._db._admin.removeUser(username, { ...commandOperationOptions });
    }
    addUser() {
        return this._chain(this._addUser, arguments);
    }
    async _addUser(username, password, addUserOptions) {
        if (!this.isDbConnected) await this._initDb();
        return await this._db.addUser(username, password, { ...addUserOptions });
    }
    removeUser() {
        return this._chain(this._removeUser, arguments);
    }
    async _removeUser(username, commandOperationOptions) {
        if (!this.isDbConnected) await this._initDb();
        return await this._db.removeUser(username, { ...commandOperationOptions });
    }
    // not in the restApi
    listControllers() {
        return this._chain(this._listControllers, arguments);
    }
    async _listControllers(filter, listCollectionsOptions) {
        if (!this.isDbConnected) await this._initDb();
        return await this._db.listCollections({ ...filter }, { ...listCollectionsOptions }).toArray();
    }
    async listAuthorizedControllers() {
        return await this.listControllers({}, { nameOnly: true, authorizedCollections: true }).then((col) => [].concat(col.map((item) => item.name)));
    }
    createController() {
        return this._chain(this._createController, arguments);
    }
    async _createController(name, createCollectionOptions) {
        if (!this.isDbConnected) await this._initDb();
        return await this._db.createCollection(name, { ...createCollectionOptions });
    }
    setControllerOptions() {
        return this._chain(this._setControllerOptions, arguments);
    }
    async _setControllerOptions(collectionOptions, commandOptions) {
        return await this._command({ collMod: this.connection.controller, ...collectionOptions }, { ...commandOptions });
    }
    renameController() {
        return this._chain(this._renameController, arguments);
    }
    async _renameController(fromCollection, toCollection, renameOptions) {
        if (!this.isDbConnected) await this._initDb();
        return await this._db.renameCollection(fromCollection, toCollection, { ...renameOptions });
    }
    dropController() {
        return this._chain(this._dropController, arguments);
    }
    async _dropController(collectionName, commandOperationOptions) {
        if (!this.isDbConnected) await this._initDb();
        return await this._db.dropCollection(collectionName, { ...commandOperationOptions });
    }
    listIndexes() {
        return this._chain(this._listIndexes, arguments);
    }
    async _listIndexes() {
        if (!this.isControllerConnected) await this._initController();
        return await this._db._collection.listIndexes().toArray();
    }
    createIndex() {
        return this._chain(this._createIndex, arguments);
    }
    async _createIndex(indexSpecification, createIndexesOptions) {
        if (!this.isControllerConnected) await this._initController();
        return await this._db._collection.createIndex([...indexSpecification], { ...createIndexesOptions });
    }
    dropIndex() {
        return this._chain(this._dropIndex, arguments);
    }
    async _dropIndex(index) {
        if (!this.isControllerConnected) await this._initController();
        return await this._db._collection.dropIndex(index);
    }
    async getValidation() {
        return await this.listControllers({ name: this.connection.controller }).then((c) => this.orm.validation(c[0].options));
    }
    async setValidation(validation, commandOptions) {
        return await this.setControllerOptions({ ...validation }, { ...commandOptions });
    }
    async info() {
        return await this.listControllers({ name: this.connection.controller }).then((c) => c[0].info);
    }
    count() {
        return this._chain(this._countDocuments, arguments);
    }
    async _countDocuments(filter, countDocumentsOptions) {
        if (!this.isControllerConnected) await this._initController();
        return { matchedCount: await this._db._collection.countDocuments({ ...filter }, { ...countDocumentsOptions }) };
    }
    distinct() {
        return this._chain(this._distinct, arguments);
    }
    async _distinct(key, filter, commandOperationOptions) {
        if (!this.isControllerConnected) await this._initController();
        return await this._db._collection.distinct(key, { ...filter }, { ...commandOperationOptions });
    }
    aggregate() {
        return this._chain(this._aggregate, arguments);
    }
    async _aggregate(pipeline, aggregateOptions) {
        if (!this.isControllerConnected) await this._initController();
        return await this._db._collection.aggregate([...pipeline], { ...aggregateOptions }).toArray();
    }
    // not in the restApi
    bulkWrite() {
        return this._chain(this._bulkWrite, arguments);
    }
    async _bulkWrite(operations, bulkWriteOptions) {
        if (!this.isControllerConnected) await this._initController();
        return await this._db._collection.bulkWrite([...operations], { ...bulkWriteOptions });
    }
    // not in the restApi
    watch() {
        return this._chain(this._watch, arguments);
    }
    async _watch(pipeline, changeStreamOptions) {
        if (!this.isControllerConnected) await this._initController();
        return await this._db._collection.watch([...pipeline], { ...changeStreamOptions });
    }
    findOne() {
        return this._chain(this._findOne, arguments);
    }
    async _findOne(filter, options) {
        if (!this.isControllerConnected) await this._initController();
        return await this._db._collection.findOne({ ...filter }, { ...options });
    }
    findMany() {
        return this._chain(this._findMany, arguments);
    }
    async _findMany(filter, options) {
        if (!this.isControllerConnected) await this._initController();
        return await this._db._collection.find({ ...filter }, { ...options }).toArray();
    }
    find() {
        return this._chain(this._find, arguments);
    }
    async _find(filter, options) {
        if (!this.isControllerConnected) await this._initController();
        return await this._db._collection.find({ ...filter }, { ...options });
    }
    insertOne() {
        return this._chain(this._insertOne, arguments);
    }
    async _insertOne(document, options) {
        if (!this.isControllerConnected) await this._initController();
        return await this._db._collection.insertOne({ ...document }, { ...options });
    }
    insertMany() {
        return this._chain(this._insertMany, arguments);
    }
    async _insertMany(documents, options) {
        if (!this.isControllerConnected) await this._initController();
        return await this._db._collection.insertMany([...documents], { ...options });
    }
    updateOne() {
        return this._chain(this._updateOne, arguments);
    }
    async _updateOne(filter, update, options) {
        if (options) delete options.upsert;
        if (!this.isControllerConnected) await this._initController();
        return await this._db._collection.updateOne({ ...filter }, { $set: { ...update } }, { ...options });
    }
    updateMany() {
        return this._chain(this._updateMany, arguments);
    }
    async _updateMany(filter, update, options) {
        if (options) delete options.upsert;
        if (!this.isControllerConnected) await this._initController();
        return await this._db._collection.updateMany({ ...filter }, { $set: { ...update } }, { ...options });
    }
    upsertOne() {
        return this._chain(this._upsertOne, arguments);
    }
    async _upsertOne(filter, update, options) {
        if (options) delete options.upsert;
        if (!this.isControllerConnected) await this._initController();
        return await this._db._collection.updateOne({ ...filter }, { $set: { ...update } }, { upsert: true, ...options });
    }
    async upsertMany(operations) {
        const operation = (args) => ({ updateMany: { filter: args[0], update: { $set: args[1] }, upsert: true } });
        for (let i = 0; i < operations.length; i++) {
            operations[i] = operation(operations[i]);
        }
        return await this.bulkWrite(operations);
    }
    deleteOne() {
        return this._chain(this._deleteOne, arguments);
    }
    async _deleteOne(filter, options) {
        if (!this.isControllerConnected) await this._initController();
        return await this._db._collection.deleteOne({ ...filter }, { ...options });
    }
    deleteMany() {
        return this._chain(this._deleteMany, arguments);
    }
    async _deleteMany(filter, options) {
        if (!this.isControllerConnected) await this._initController();
        return await this._db._collection.deleteMany({ ...filter }, { ...options });
    }
    _chain(fn, args) {
        this.p = this.p.then(() => fn.apply(this, Array.prototype.slice.call(args)));
        return this;
    }
    then(a, b) {
        this.p = this.p.then(a, b);
        return this;
    }
    catch(fn) {
        this.p = this.p.catch(fn);
        return this;
    }
}

module.exports = Model;
