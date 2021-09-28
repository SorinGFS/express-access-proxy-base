'use strict';
// returns configured servers
const fn = require('../functions');
const fs = require('../fs');
const Server = require('./server');

module.exports = (serverConfigs) => {
    // prepare server auth options and JWT according config
    const preparedServers = [];
    serverConfigs.forEach((config) => {
        // auth configuration not allowed at location level except auth.mode and only if switches the main setting
        function locationAuthCleanup(auth) {
            let putItBack;
            if (typeof auth.mode !== 'undefined' && auth.mode !== config.server.auth.mode) {
                if (!config.server.auth.mode) putItBack = auth.mode;
                if (config.server.auth.mode && !auth.mode) putItBack = auth.mode;
            }
            auth = {};
            if (putItBack !== undefined) auth.mode = putItBack;
            return [{ auth: auth }];
        }
        if (config.server.locations) {
            fn.parseDeepKey(config.server.locations, 'auth', locationAuthCleanup);
        }
        // analize each auth and update jwt according given settings
        function setAuth(auth) {
            if (!auth.jwt) auth.jwt = {};
            if (!auth.jwt.signOptions) auth.jwt.signOptions = {};
            if (!auth.jwt.verifyOptions) auth.jwt.verifyOptions = {};
            if (config.secretKey || config.privateKeyPath) {
                auth.jwt.secretOrPrivateKey = config.secretKey || fs.readFile(config.privateKeyPath).toString();
            }
            if (config.secretKey || config.publicKeyPath) {
                auth.jwt.secretOrPublicKey = config.secretKey || fs.readFile(config.publicKeyPath).toString();
            }
            if (!auth.maxInactivitySeconds) {
                auth.maxInactivitySeconds = 1800; // 30m
            }
            if (!auth.refreshInSeconds) {
                auth.refreshInSeconds = 84600; // 1d
            }
            if (auth.algorithm) {
                auth.jwt.signOptions.algorithm = auth.algorithm;
            }
            if (auth.issuer) {
                if (typeof auth.issuer !== 'boolean') {
                    auth.jwt.signOptions.issuer = auth.issuer;
                    auth.jwt.verifyOptions.issuer = auth.issuer;
                } else {
                    if (auth.provider && auth.provider.name) {
                        if (auth.provider.name === 'local') {
                            auth.jwt.signOptions.issuer = process.env.APP_NAME;
                            auth.jwt.verifyOptions.issuer = process.env.APP_NAME;
                        } else {
                            auth.jwt.signOptions.issuer = auth.provider.name;
                            auth.jwt.verifyOptions.issuer = auth.provider.name;
                        }
                    }
                }
            }
            if (auth.jwtid) {
                if (typeof auth.jwtid !== 'boolean') {
                    auth.jwt.signOptions.jwtid = auth.jwtid;
                    auth.jwt.verifyOptions.jwtid = auth.jwtid;
                } else {
                    if (auth.provider && auth.provider.id) {
                        auth.jwt.signOptions.jwtid = auth.provider.id.toString();
                        auth.jwt.verifyOptions.jwtd = auth.provider.id.toString();
                    }
                }
            }
            if (auth.audience) {
                auth.jwt.signOptions.audience = typeof auth.audience !== 'boolean' ? auth.audience : config.serverName;
                auth.jwt.verifyOptions.audience = config.serverName;
            }
            // If iat is inserted in the payload, it will be used instead of the real timestamp
            if (auth.noTimestamp) {
                auth.jwt.signOptions.noTimestamp = true;
            }
            if (auth.mode && auth.mode === 'refreshTokens') {
                if (auth.expiresIn) {
                    auth.jwt.signOptions.expiresIn = auth.expiresIn;
                } else {
                    auth.jwt.signOptions.expiresIn = '30m';
                }
                if (auth.notBefore) {
                    auth.jwt.signOptions.notBefore = auth.notBefore;
                }
                if (auth.clockTolerance) {
                    auth.jwt.verifyOptions.clockTolerance = auth.clockTolerance;
                }
                if (auth.clockTimestamp) {
                    auth.jwt.verifyOptions.clockTimestamp = auth.clockTimestamp;
                }
                if (auth.maxAge) {
                    auth.jwt.verifyOptions.maxAge = auth.maxAge;
                }
                if (auth.nonce) {
                    auth.jwt.verifyOptions.nonce = auth.nonce;
                }
            }
            return [{ auth: auth }];
        }
        fn.parseDeepKey(config.server, 'auth', setAuth);
        preparedServers.push({ serverName: config.serverName, server: config.server });
    });
    // serializing serverName
    const servers = [];
    preparedServers.forEach((config) => {
        let names = [];
        if (Array.isArray(config.serverName)) {
            config.serverName.forEach((name) => names.push(fn.btoa(`<${name}>`)));
        } else {
            names.push(fn.btoa(`<${config.serverName}>`));
        }
        servers[names.join()] = new Server(config.server);
    });
    return servers;
};
