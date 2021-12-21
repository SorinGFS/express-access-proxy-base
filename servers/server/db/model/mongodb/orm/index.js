'use strict';
// returns orm based on related context
module.exports = {
    textSearch: (ctx) => ({ $text: { $search: ctx.q, $language: ctx.lang || '', $caseSensitive: ctx.caseSensitive || false, $diacriticSensitive: ctx.diacriticSensitive || false } }),
    validation: (ctx) => (({ validator, validationLevel, validationAction }) => ({ validator, validationLevel, validationAction }))(ctx),
};
