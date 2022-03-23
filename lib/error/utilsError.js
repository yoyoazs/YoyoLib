class EmptyArrayError extends Error {
    constructor(message) {
        super(message)
        this.name = "EmptyArrayError"
    }
}

class MessageEmptyError extends Error {
    constructor(message) {
        super(message)
        this.name = "MessageEmptyError"
    }
}

class FileNotFoundError extends Error {
    constructor(message) {
        super(message)
        this.name = "FileNotFoundError"
    }
}

class DirNotFoundError extends Error {
    constructor(message) {
        super(message)
        this.name = "DirNotFoundError"
    }
}

module.exports = {
    EmptyArrayError,
    MessageEmptyError,
    FileNotFoundError,
    DirNotFoundError
}