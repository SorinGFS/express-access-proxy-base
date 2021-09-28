'use strict';
// This is a custom implementation of Auth0's JsonWebToken library: https://github.com/auth0/node-jsonwebtoken
const fn = require('../functions');
const jwt = require('jsonwebtoken');
const createError = require('http-errors');

class Server {
    constructor(configServer) {
        Object.assign(this, configServer);
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
            this.auth.jwt.login = async (req, providerToken) => {
                const payload = this.auth.jwt.payload(providerToken);
                const filter = { user: { ...payload } };
                if (req.server.auth.bindCsrs) filter.user.csrs = req.cookies.csrs;
                if (req.server.auth.bindProvider) filter.user.provider = req.server.auth.provider;
                if (req.server.auth.bindFingerprint) filter.user.fingerprintHash = req.fingerprint.hash;
                const expiresAtSeconds = req.server.auth.mode === 'refreshTokens' ? req.server.auth.refreshInSeconds : req.server.auth.maxInactivitySeconds;
                const update = { token: providerToken, issuedAt: new Date(), expiresAt: new Date(Date.now() + expiresAtSeconds * 1000) };
                if (req.server.auth.mode === 'refreshTokens') update.refresh = fn.generateUUID();
                req.server.Permissions.upsertOne(filter, update);
                return { jwt: this.auth.jwt.sign(payload), refresh: update.refresh };
            };
            this.auth.jwt.refresh = async (req) => {
                const filter = { refresh: req.body.refresh };
                const permission = await req.server.Permissions.findOne(filter);
                if (!permission) throw createError.Forbidden();
                if (permission.expiresAt < new Date()) {
                    req.server.Permissions.deleteOne(filter);
                    throw createError.Unauthorized();
                }
                const token = req.body.jwt;
                return { jwt: this.auth.jwt.resign(token), refresh: req.body.refresh };
            };
            this.auth.jwt.permission = async (req) => {
                // since this app handles multiple hosts the user.id is not unique, so an extra field is required to uniquely identify the login
                // if fingerprint was used user can login from a single fingerprint (it also protects it against captured token)
                const filter = { user: req.user };
                const permission = await req.server.Permissions.findOne(filter);
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
                const filter = { user: req.user };
                return await req.server.Permissions.upsertOne(filter, { expiresAt: new Date(Date.now() + req.server.auth.maxInactivitySeconds * 1000) });
            };
            this.auth.jwt.logout = async (req) => {
                const filter = { user: req.user };
                return await req.server.Permissions.deleteOne(filter);
            };
            this.auth.jwt.user = (req, token) => {
                let user;
                try {
                    user = this.auth.jwt.verify(token);
                    delete user.iat;
                    delete user.nbf;
                    delete user.exp;
                    delete user.iss;
                    delete user.aud;
                    delete user.sub;
                    delete user.jti;
                    if (req.server.auth.bindCsrs) user.csrs = req.cookies.csrs;
                    if (req.server.auth.bindProvider) user.provider = req.server.auth.provider;
                    if (req.server.auth.bindFingerprint) user.fingerprintHash = req.fingerprint.hash;
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
                return user;
            };
        }
    }
}

module.exports = Server;
