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
logger.error(content: "test error");
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

console.log(multiLang.use("message.testVariables", {user: "yoyoazs"}));
//print Hello yoyoazs
```

# Experienced usage

## logger
```js
logger.log({content: "test log", date: false, console: false, log: false});
```
date: allows to display the date or not<br>
console: allows to display in the console or not<br>
log : allows to save in the log file or not<br>

These three parameters are set to "true" by default

```js
logger.log({content: "%FRtest log"});
```
Allows to log in the console in red<br>

You can change the color of the font or the background with the letter F for the font and B for the background then add behind the letter of the color (B, R, G, Y, M, C, W ) and use UR to reset (don't forget the % in front)

[stars-shield]: https://img.shields.io/github/stars/yoyoazs/YoyoLib.svg?style=for-the-badge
[stars-url]: https://github.com/yoyoazs/YoyoLib/stargazers
[issues-shield]: https://img.shields.io/github/issues/yoyoazs/YoyoLib.svg?style=for-the-badge
[issues-url]: https://github.com/yoyoazs/YoyoLib/issues
