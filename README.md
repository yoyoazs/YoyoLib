# YoyoLib
A simple module for node.js

# Installation

```bash
npm install discord.js
```


# Example usage

```js
const YoyoLib = require('yoyolib')
const logger = YoyoLib.createLogger()

//Print a log on a console
logger.log("test log");
//Print a info on a console
logger.info("test info");
//Print a warn on a console
logger.warn("test warn");
//Print a error on a console
logger.error(content: "test error");
```

# Experienced usage

```js
logger.log({content: "test log", date: false, console: false, log: false});
```
date: allows to display the date or not
console: allows to display in the console or not
log : allows to save in the log file or not

These three parameters are set to "true" by default

```js
logger.log({content: "%FRtest log"})
```
Allows to log in the console in red

You can change the color of the font or the background with the letter F for the font and B for the background then add behind the letter of the color (B, R, G, Y, M, C, W ) and use UR to reset (don't forget the % in front)
