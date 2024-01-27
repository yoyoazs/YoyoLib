[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]

# YoyoLib

**YoyoLib** is a lightweight library designed for handling logging and multi-language support in your Node.js applications.

## Features

- **Logging:** Create log messages with customizable formatting and the ability to write logs to files using the `Logger` class.

- **Multi-language Support:** Easily manage multi-language support for your application with the `LangManager` class.

## Installation

```bash
npm install yoyolib
```

# Example usage

## Logger
```js
// Import the yoyolib
const { createLogger } = require('yoyolib');

// Create a logger instance
const logger = createLogger();

// Print a log on the console
logger.log("test log");

// Print an info on the console
logger.info("test info");

// Print a warn on the console
logger.warn("test warn");

// Print an error on the console
logger.error("test error");

// Print a log with additional options
logger.log({ content: "test log", name: "TEST" });

// Print a log with options to control console and log writing
logger.log({ content: "test log", console: false, log: false });
```

## LangManager

### json file

```json

// "en_EN"
{
    "message": {
        "test": "this is a test.",
        "testVariables": "Hello {user} !"
    }
}

// "fr_FR"
{
    "message": {
        "test": "ceci est un test.",
        "testVariables": "Bonjour {user} !"
    }
}

```
Create a folder named 'lang' and place your language files ('fr_FR.json' and 'en_EN.json') inside.

### js

```js
// Import the yoyolib
const { createLangManager } = require('yoyolib');

// Create a multi-language support handler
const langManager = createLangManager();
let message;

// Add a language
langManager.add('en', 'en_EN');
langManager.add('fr', 'fr_FR');

// Set the active language
langManager.set('en');

// Use a multi-language system
message = langManager.use('message.test');
console.log(message); // Output: this is a test.
message = langManager.use('message.testVaraibles', {user: "yoyoazs"});
console.log(message); // Output: Hello yoyoazs !

// Set the active language
langManager.set('fr');

// Use a multi-language system
message = langManager.use('message.test');
console.log(message); // Output: ceci est un test.
message = langManager.use('message.testVaraibles', {user: "yoyoazs"});
console.log(message); // Output: Bonjour yoyoazs !
```

## API

### `createLogger(logday = false, date = false, args = undefined): Logger`

Creates a Logger instance with optional configurations.

- **logday** (boolean): If true, creates a log file for the day.
- **date** (boolean): If true, logs both date and hours; otherwise, only logs hours.
- **args** (object): Additional configuration options for the Logger.

Returns a Logger instance.

### `createLangManager(): LangManager`

Creates a new instance of a multi-language support handler.

Returns a LangManager instance.

## License
This project is licensed under the [YoyoLib Custom License](LICENSE) - see the LICENSE file for details.

For more information, please refer to our [wiki](https://github.com/yoyoazs/YoyoLib/wiki)

[stars-shield]: https://img.shields.io/github/stars/yoyoazs/YoyoLib.svg?style=for-the-badge
[stars-url]: https://github.com/yoyoazs/YoyoLib/stargazers
[issues-shield]: https://img.shields.io/github/issues/yoyoazs/YoyoLib.svg?style=for-the-badge
[issues-url]: https://github.com/yoyoazs/YoyoLib/issues
