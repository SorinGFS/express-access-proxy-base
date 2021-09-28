'use strict';
// returns orm based on related context
module.exports = {
    textSearch: (object) => ({ $text: { $search: object.search, $language: object.language || '', $caseSensitive: object.caseSensitive || false, $diacriticSensitive: object.diacriticSensitive || false } }),
};
