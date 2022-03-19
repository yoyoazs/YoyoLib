export function warn(args) {
    var date = convertDateToDDMMYYHHMMSS(new Date())
    if (typeof args == "object") {
        if (args.date === undefined || args.date == true) args.content = `${style.FW}[${convertDateToDDMMYYHHMMSS(new Date())}/${style.FY}WARN${style.FW}]${style.FY} ${args.content}`;
        if (args.content.includes("%")) args.content = await formatMessage(args.content);
        if (args.console === undefined || args.console == true) console.warn(args.content);
        if (args.log === undefined || args.log == true) writeLog(args.content, this.fileName);
    } else {
        args = `${style.FW}[${date}/${style.FY}WARN${style.FW}]${style.FY} ${args}`;
        console.warn(args);
        writeLog(args, this.fileName);
    }
}