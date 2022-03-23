class LangFileError extends Error {
    constructor(message) {
        super(message)
        this.name = "LangFileError"
    }
}

class LangNameError extends Error {
    constructor(message) {
        super(message)
        this.name = "LangNameError"
    }
}

module.exports = {
    LangNameError,
    LangFileError
}
