export function info(args) {
    var date = convertDateToDDMMYYHHMMSS(new Date())
    if (typeof args == "object") {
        if (args.date === undefined || args.date == true) args.content = `${style.FW}[${date}/${style.FC}INFO${style.FW}]${style.FC} ${args.content}`;
        if (args.content.includes("%")) args.content = await formatMessage(args.content);
        if (args.console === undefined || args.console == true) console.info(args.content);
        if (args.log === undefined || args.log == true) writeLog(args.content, this.fileName);
    } else {
        args = `${style.FW}[${date}/${style.FC}INFO${style.FW}]${style.UR} ${args}`
        console.info(args);
        writeLog(args, this.fileName);
    }
}