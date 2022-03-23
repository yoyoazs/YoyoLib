const multiLangError = require('./multiLangError');
const utilsError = require('./utilsError');

exports.LangNameError = multiLangError.LangNameError;
exports.LangFileError = multiLangError.LangFileError;
exports.EmptyArrayError = utilsError.EmptyArrayError;
exports.MessageEmptyError = utilsError.MessageEmptyError;
exports.FileNotFoundError = utilsError.FileNotFoundError
exports.DirNotFoundError = utilsError.DirNotFoundError