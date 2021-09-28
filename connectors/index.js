'use strict';
// dynamically require module
module.exports = ({ connector }) => require(`./${connector}`);
