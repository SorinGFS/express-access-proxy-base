'use strict';
// https://docs.mongodb.com/realm/functions/json-and-bson/#ejson--extended-json-
// An easier working method for passing json data to db would be to get the bson validation schema in frontend, to serialize
// the data there based on validation schema and here just to replace the given expressions with bson types. But that method
// would be error prone and an extra convern for the webmaster.
const fn = require('../../functions');
const { ObjectId, Int32, Long, Double, Decimal128, BSONRegExp, Code, Binary } = require('mongodb');

const topLevelKeys = ['$and', '$or', '$nor'];
const isTopLevelKey = (key) => {
    if (topLevelKeys.includes(key)) return true;
    return false;
};

// const allowedTypeConversionAggregateStages = ['$facet', '$match', '$set'];
const deniedTypeConversionAggregateStages = ['$addFields', '$bucket', '$bucketAuto', '$collStats', '$count', '$currentOp', '$geoNear', '$graphLookup', '$group', '$indexStats', '$limit', '$listLocalSessions', '$listSessions', '$lookup', '$merge', '$out', '$planCacheStats', '$project', '$redact', '$replaceRoot', '$replaceWith', '$sample', '$search', '$setWindowFields', '$skip', '$sort', '$sortByCount', '$unionWith', '$unset', '$unwind'];
const deniedTypeConversionMidLevelKeys = [].concat(deniedTypeConversionAggregateStages);
const isDeniedTypeConversionMidLevelKey = (key) => {
    if (key.charAt(0) === '$' && deniedTypeConversionMidLevelKeys.includes(key)) return true;
    return false;
};

const allowedTypeConversionLowLevelKeys = ['$eq', '$ne', '$gt', '$gte', '$lt', '$lte'];
const isAllowedTypeConversionLowLevelKey = (key) => {
    if (allowedTypeConversionLowLevelKeys.includes(key)) return true;
    return false;
};

const jsonToBson = (value, bsonType) => {
    if (bsonType === 'object') return value;
    if (bsonType === 'array') return value;
    if (bsonType === 'null') return value && value.toLowerCase() === 'null' ? null : value;
    if (bsonType === 'bool') return Boolean(value);
    if (bsonType === 'string') return String(value);
    if (bsonType === 'regex') return BSONRegExp(value.$regularExpression.pattern, value.$regularExpression.options);
    if (bsonType === 'objectId') return new ObjectId(value);
    if (bsonType === 'int') return new Int32(value);
    if (bsonType === 'long') return new Long(String(value));
    if (bsonType === 'double') return new Double(value);
    if (bsonType === 'decimal') return new Decimal128(String(value));
    if (bsonType === 'date') return new Date(value);
    if (bsonType === 'binData') return new Binary(value);
    if (bsonType === 'javascript') return new Code(value);
    return value;
};

const bsonToJson = (value, jsonSchemaType) => {
    if (jsonSchemaType === 'object') return value;
    if (jsonSchemaType === 'array') return value;
    if (jsonSchemaType === 'null') return value && value.toLowerCase() === 'null' ? null : value;
    if (jsonSchemaType === 'boolean') return Boolean(value);
    if (jsonSchemaType === 'string') return String(value);
    if (jsonSchemaType === 'integer') return Number(value);
    if (jsonSchemaType === 'number') return Number(value);
    return value;
};

// return format is for use with replaceDeep
const bsonSchemaToJsonSchema = (bsonType, jsonTypeName) => {
    const jsonSchemaType = jsonTypeName || 'type';
    if (bsonType === 'object') return [{ [jsonSchemaType]: 'object' }];
    if (bsonType === 'array') return [{ [jsonSchemaType]: 'array' }];
    if (bsonType === 'null') return [{ [jsonSchemaType]: 'null' }];
    if (bsonType === 'bool') return [{ [jsonSchemaType]: 'boolean' }];
    if (bsonType === 'string') return [{ [jsonSchemaType]: 'string' }];
    if (bsonType === 'regex') return [{ [jsonSchemaType]: 'string' }];
    if (bsonType === 'objectId') return [{ [jsonSchemaType]: 'string' }];
    if (bsonType === 'int') return [{ [jsonSchemaType]: 'integer' }];
    if (bsonType === 'long') return [{ [jsonSchemaType]: 'integer' }];
    if (bsonType === 'double') return [{ [jsonSchemaType]: 'number' }];
    if (bsonType === 'decimal') return [{ [jsonSchemaType]: 'number' }];
    if (bsonType === 'date') return [{ [jsonSchemaType]: 'string' }];
    if (bsonType === 'binData') return [{ [jsonSchemaType]: 'string' }];
    if (bsonType === 'javascript') return [{ [jsonSchemaType]: 'string' }];
    return [bsonType];
};

// return format is for use with replaceDeep
const jsonSchemaToBsonSchema = (jsonSchemaType, bsonTypeName) => {
    const bsonType = bsonTypeName || 'bsonType';
    if (jsonSchemaType === 'object') return [{ [bsonType]: 'object' }];
    if (jsonSchemaType === 'array') return [{ [bsonType]: 'array' }];
    if (jsonSchemaType === 'null') return [{ [bsonType]: 'null' }];
    if (jsonSchemaType === 'boolean') return [{ [bsonType]: 'bool' }];
    if (jsonSchemaType === 'string') return [{ [bsonType]: 'string' }];
    if (jsonSchemaType === 'integer') return [{ [bsonType]: 'long' }];
    if (jsonSchemaType === 'number') return [{ [bsonType]: 'double' }];
    return [jsonSchemaType];
};

// keys may be normal keys, numeric keys, dot notation keys, operators (top, mid, or low level)
// the goal is to reach to the value only for appliable cases
const parseDeepSchema = (data, schema, parse) => {
    if (data && schema && typeof data === 'object') {
        // the important thing is that parent is object, parsed key must be a value having a schema
        Object.keys(data).forEach((key) => {
            if (isTopLevelKey(key)) {
                // each element inside these keys corresponds to the whole schema
                for (let i = 0; i < data[key].length; i++) {
                    parseDeepSchema(data[key][i], schema, parse);
                }
            } else if (typeof data[key] === 'object') {
                if (fn.getKeySchema(data, key, schema)) {
                    if (!Array.isArray(data)) {
                        parseDeepSchema(data[key], fn.getKeySchema(data, key, schema), parse);
                    } else {
                        parseDeepSchema(data[key], schema, parse);
                    }
                } else if (!isDeniedTypeConversionMidLevelKey(key)) {
                    // short circuiting mid level variable keys by passing the given schema to lower level
                    // deny opertors not related to field data type
                    parseDeepSchema(data[key], schema, parse);
                }
            } else {
                if (fn.getKeySchema(data, key, schema)) {
                    data[key] = parse(data[key], fn.getKeySchema(data, key, schema));
                } else if (isAllowedTypeConversionLowLevelKey(key)) {
                    data[key] = parse(data[key], schema);
                }
            }
        });
    }
};

// converts if possible the given data based on validation schema retrieved from db or cache
const serialize = (data, schema) => {
    if (!schema) return;
    const parser = (value, schema) => {
        if (!schema || typeof value === 'object') throw new Error('Parsed key must be a value having a schema.');
        // console.log(value, 'to:', schema.bsonType);
        return jsonToBson(value, schema.bsonType);
    };
    // many operations
    if (Array.isArray(data)) {
        data.forEach((item) => {
            // rare case when operations contain many unnamed stages
            if (Array.isArray(item)) {
                item.forEach((subItem) => {
                    parseDeepSchema(subItem, schema, parser);
                });
            } else {
                parseDeepSchema(item, schema, parser);
            }
        });
    } else {
        parseDeepSchema(data, schema, parser);
    }
};

// data may have the following forms: object, array of objects, or array of arrays of objects
const deserialize = (data) => {
    const types = ['$numberDecimal'];
    const parser = (parent, key) => {
        if (parent[key].$numberDecimal) return [{ [key]: bsonToJson(parent[key].$numberDecimal, bsonSchemaToJsonSchema('decimal')[0].type) }];
        return [];
    };
    types.forEach((type) => {
        fn.parseDeepKeyParent(data, type, parser);
    });
    return data;
};

module.exports = { serialize, deserialize };
