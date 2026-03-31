const multiLangError = require('./multiLangError');
const utilsError = require('./utilsError');
const validationError = require('./ValidationError');

exports.LangNameError    = multiLangError.LangNameError;
exports.LangFileError    = multiLangError.LangFileError;
exports.EmptyArrayError  = utilsError.EmptyArrayError;
exports.MessageEmptyError = utilsError.MessageEmptyError;
exports.FileNotFoundError = utilsError.FileNotFoundError;
exports.DirNotFoundError  = utilsError.DirNotFoundError;
exports.ConfigError       = utilsError.ConfigError;
exports.EnvError          = utilsError.EnvError;
exports.ValidationError   = validationError.ValidationError;