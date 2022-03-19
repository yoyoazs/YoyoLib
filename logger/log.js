export function log({args}) {
    var date = convertDateToDDMMYYHHMMSS(new Date())
    if (typeof args == "object") {
        if (args.date === undefined || args.date == true) args.content = `${style.FW}[${date}/${style.FG}LOG${style.FW}]${style.FG} ${args.content}`;
        if (args.content.includes("%")) args.content = await formatMessage(args.content);
        if (args.console === undefined || args.console == true) console.log(args.content);
        if (args.log === undefined || args.log == true) writeLog(args.content, this.fileName);
    } else {
        args = `${style.FW}[${date}/${style.FG}LOG${style.FW}]${style.FG} ${args}`
        console.log(args);
        writeLog(args, this.fileName);
    }
}