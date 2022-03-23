[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]

# YoyoLib
A simple module for node.js

# Installation

```bash
npm install yoyolib
```


# Example usage

## logger
```js
const YoyoLib = require('yoyolib');
const logger = YoyoLib.createLogger();

//Print a log on a console
logger.log("test log");
//Print a info on a console
logger.info("test info");
//Print a warn on a console
logger.warn("test warn");
//Print a error on a console
logger.error("test error");
```

## multilang

### json file

```json

//en_EN
{
    "message": {
        "test": "this is a test",
        "testVariables" : "Hello {user}"
    }
}

//fr_FR
{
    "message": {
        "test": "ceci est un test",
        "testVariables" : "Bonjour {user}"
    }
}

```
Create a folder named lang and put your fr_FR and en_EN files there

## js

```js
const multiLang = YoyoLib.createMultiLang();

multiLang.add("fr_FR", "fr_FR");
multiLang.add("en_EN", "en_EN");

multiLang.set("fr_FR");

console.log(multiLang.use("message.test"));
//print ceci est un test

multiLang.set("en_EN");
console.log(multiLang.use("message.test"));
//print this is a test
```

for more information look a wiki https://github.com/yoyoazs/YoyoLib/wiki

[stars-shield]: https://img.shields.io/github/stars/yoyoazs/YoyoLib.svg?style=for-the-badge
[stars-url]: https://github.com/yoyoazs/YoyoLib/stargazers
[issues-shield]: https://img.shields.io/github/issues/yoyoazs/YoyoLib.svg?style=for-the-badge
[issues-url]: https://github.com/yoyoazs/YoyoLib/issues
