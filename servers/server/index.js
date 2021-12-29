'use strict';
// This is a custom implementation of Auth0's JsonWebToken library: https://github.com/auth0/node-jsonwebtoken
const fs = require('../../fs');
const fn = require('../../fn');
const jwt = require('jsonwebtoken');
const createError = require('http-errors');

class Server {
    constructor(configServer) {
        Object.assign(this, configServer, { fs, fn });
        if (!this.site) this.site = {};
        if (this.auth) {
            if (!this.auth.jwt) this.auth.jwt = {};
            this.auth.jwt.sign = (payload) => {
                return jwt.sign(payload, this.auth.jwt.secretOrPrivateKey, this.auth.jwt.signOptions);
            };
            this.auth.jwt.verify = (token) => {
                return jwt.verify(token, this.auth.jwt.secretOrPublicKey, this.auth.jwt.verifyOptions);
            };
            this.auth.jwt.verifyExpired = (token) => {
                return jwt.verify(token, this.auth.jwt.secretOrPublicKey, Object.assign({}, this.auth.jwt.verifyOptions, { ignoreExpiration: true }));
            };
            this.auth.jwt.resign = (token) => {
                // extract clean payload from our token in order to resign it (extending validity)
                const payload = this.auth.jwt.verifyExpired(token);
                // our signature converted all needed options into claims, they are in the payload
                delete payload.iat;
                delete payload.nbf;
                delete payload.exp;
                delete payload.iss;
                delete payload.aud;
                delete payload.sub;
                delete payload.jti;
                return jwt.sign(payload, this.auth.jwt.secretOrPrivateKey, this.auth.jwt.signOptions);
            };
            this.auth.jwt.decode = (token, decodeOptions) => {
                return jwt.decode(token, decodeOptions);
            };
            this.auth.jwt.payload = (token, decodeOptions) => {
                // extract clean payload from external tokens in order to countersign as trusted access provider
                const payload = this.auth.jwt.decode(token, decodeOptions);
                // The issuer's signature converted all needed options into claims, they are in the payload
                delete payload.iat;
                delete payload.nbf;
                delete payload.exp;
                delete payload.iss;
                delete payload.aud;
                delete payload.sub;
                delete payload.jti;
                return payload;
            };
            this.auth.jwt.login = async (req, providerToken, providerUser) => {
                const payload = this.auth.jwt.payload(providerToken);
                const filter = { authenticated: { ...payload } };
                if (req.server.auth.bindCsrs) filter.authenticated.csrs = req.cookies.csrs;
                if (req.server.auth.bindProvider) filter.authenticated.provider = req.server.auth.provider;
                if (req.server.auth.bindFingerprint) filter.authenticated.fingerprintHash = req.fingerprint.hash;
                const expiresAtSeconds = req.server.auth.mode === 'refreshTokens' ? req.server.auth.refreshInSeconds : req.server.auth.maxInactivitySeconds;
                const update = { token: providerToken, issuedAt: new Date(), expiresAt: new Date(Date.now() + expiresAtSeconds * 1000) };
                if (req.server.auth.provider.trusted) Object.assign(update, { user: providerUser });
                if (req.server.auth.mode === 'refreshTokens') update.refresh = this.fn.generateUUID();
                await req.accessDb.controller('permissions').upsertOne(filter, update);
                return { jwt: this.auth.jwt.sign(payload), refresh: update.refresh };
            };
            this.auth.jwt.refresh = async (req) => {
                const filter = { refresh: req.body.refresh };
                const permission = await req.accessDb.controller('permissions').findOne(filter);
                if (!permission) throw createError.Forbidden();
                if (permission.expiresAt < new Date()) {
                    await req.accessDb.controller('permissions').deleteOne(filter);
                    throw createError.Unauthorized();
                }
                const token = req.body.jwt;
                return { jwt: this.auth.jwt.resign(token), refresh: req.body.refresh };
            };
            this.auth.jwt.permission = async (req) => {
                // since this app handles multiple hosts the authenticated.id is not unique, so an extra field is required to uniquely identify the login
                // if fingerprint was used authenticated user can login from a single fingerprint (it also protects it against captured token)
                const filter = { authenticated: req.authenticated };
                const permission = await req.accessDb.controller('permissions').findOne(filter);
                // permission already cleared from db (usually this error can appear only in API testing clients, since )
                if (!permission) throw createError(403, 'Invalid credentials.');
                // validate permission (if JWT expiresIn is used expiresAt will not extend that time)
                if (permission.expiresAt > new Date()) {
                    if (req.server.auth.mode === 'slideExpiration') {
                        // slide token expiration by maxInactivitySeconds
                        await req.server.auth.jwt.slideExpiration(req);
                    }
                    return permission;
                } else {
                    // existing permission expired so clear it form db
                    await req.server.auth.jwt.logout(req);
                    throw createError(401, 'Login expired due to inactivity.');
                }
            };
            this.auth.jwt.slideExpiration = async (req) => {
                const filter = { authenticated: req.authenticated };
                return await req.accessDb.controller('permissions').upsertOne(filter, { expiresAt: new Date(Date.now() + req.server.auth.maxInactivitySeconds * 1000) });
            };
            this.auth.jwt.logout = async (req) => {
                const filter = { authenticated: req.authenticated };
                return await req.accessDb.controller('permissions').deleteOne(filter);
            };
            this.auth.jwt.authenticate = (req, token) => {
                let authenticated;
                try {
                    authenticated = this.auth.jwt.verify(token);
                    delete authenticated.iat;
                    delete authenticated.nbf;
                    delete authenticated.exp;
                    delete authenticated.iss;
                    delete authenticated.aud;
                    delete authenticated.sub;
                    delete authenticated.jti;
                    if (req.server.auth.bindCsrs) authenticated.csrs = req.cookies.csrs;
                    if (req.server.auth.bindProvider) authenticated.provider = req.server.auth.provider;
                    if (req.server.auth.bindFingerprint) authenticated.fingerprintHash = req.fingerprint.hash;
                } catch (error) {
                    // replacing jwt errors with regular errors to reduce attack surface
                    if (/expired/.test(error)) {
                        throw createError(401, 'Login expired.');
                    } else if (/invalid/.test(error)) {
                        throw createError(403, 'Invalid credentials.');
                    } else {
                        throw createError(error);
                    }
                }
                return authenticated;
            };
        }
    }
    // get api's method and arguments required to perform the rest request
    getApi = (restApi, ctx) => Promise.resolve(restApi.filter((item) => this.fn.isExactContextMatch(ctx, item.rest))[0].api);
    // set dynamic Model
    getModel = (connection) => this._getModel(connection);
    // get dynamic Model
    _getModel = (connection) => require('./db/model')(connection);
    // direct response
    send = (req, res) => {
        if (req.setHeaders) res.set(req.setHeaders);
        res.sendStatus(req.sendStatus);
    };
    // combine server and location rules
    parseLocations = (req) => {
        if (req.server.locations) {
            return req.server.locations.some((location) => {
                return Object.keys(location).some((path) => {
                    req.sendStatus = 0;
                    if (new RegExp(path, location[path].regexFlags).test(req.path)) {
                        if (location[path].urlRewrite) {
                            if (location[path].return) req.sendStatus = location[path].return;
                            // return true here to avoid applying the settings (except for the break flag)
                            if (this.rewrite(req, location[path].urlRewrite)) return true;
                        }
                        req.server = this.fn.mergeDeep({}, req.server, location[path]);
                        return true;
                    }
                    return false;
                });
            });
        }
        return false;
    };
    // url rewrite, syntax: [regex, replacement, breakingFlag?, regexFlags?] or arrays of the same format
    rewrite = (req, rules) => {
        // if rules not array of arrays convert them to it
        if (!Array.isArray(rules[0])) rules = [rules];
        // prevent infinite loops in case of wrong rules, this also limits to 10 the rewrite rules array
        if (!req.rewriteCycles) req.rewriteCycles = 0;
        if (++req.rewriteCycles && req.rewriteCycles > 10) return true;
        // returns true if the loop was interrupted and false if not
        return rules.some((rule) => {
            // rewrite the url
            req.url = req.url.replace(new RegExp(rule[0], rule[3]), rule[1]);
            // meaning: has breaking flag
            if (rule[2]) {
                // meaning: location is NOT in the right path, rewrite the url, rescan locations for a match, apply its settings
                if (rule[2] === 'last') return this.parseLocations(req);
                // meaning: location is in the right path, loop all rules to rewrite the url, then apply path settings
                if (rule[2] === 'break') return false;
                // meaning: found, send 302 temporary redirect to new url
                if (rule[2] === 'redirect') return Object.assign(req, { sendStatus: 302, setHeaders: { Location: req.url } });
                // meaning: found, send 301 permanent redirect to new url
                if (rule[2] === 'permanent') return Object.assign(req, { sendStatus: 301, setHeaders: { Location: req.url } });
            }
            // meaning: no breaking flag, check the next rule
            return false;
        });
    };
}

module.exports = Server;
