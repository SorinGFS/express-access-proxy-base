'use strict';
// dynamically export the folders and nodejs supported files in current working dir
const fs = require('./fs');
const dirs = fs.dirs(__dirname);
const files = fs.files(__dirname);

const fileName = (file) => {
    file = file.split('.');
    if (file.length > 1) file.pop();
    return file.join('.');
};

dirs.forEach((dir) => {
    Object.assign(module.exports, { [dir]: require(fs.pathResolve(__dirname, dir)) });
});
files.forEach((file) => {
    if (['js', 'mjs', 'json'].includes(file.split('.').pop())) {
        Object.assign(module.exports, { [fileName(file)]: require(fs.pathResolve(__dirname, file)) });
    }
});