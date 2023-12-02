const os = require('os');
const readline = require('readline');

class profiler {
    constructor() {
        // Autres initialisations de votre classe
        this.profilerEnabled = false;
        this.consoleWidth = process.stdout.columns || 80;
    }

    // Méthode pour activer le profiler
    enableProfiler() {
        this.profilerEnabled = true;
        this.startProfiler();
    }

    // Méthode pour désactiver le profiler
    disableProfiler() {
        this.profilerEnabled = false;
        this.stopProfiler();
    }

    // Méthode pour afficher les informations du profiler
    startProfiler() {
        this.profilerInterval = setInterval(() => {
            this.displaySystemStats();
        }, 2000);
    }

    // Méthode pour arrêter l'affichage des informations du profiler
    stopProfiler() {
        clearInterval(this.profilerInterval);
        this.clearLine();
    }

    // Méthode pour effacer la ligne courante dans la console
    clearLine() {
        process.stdout.write(ansiEscapes.eraseLines(1));
    }

    // Méthode pour obtenir la largeur de la console
    getConsoleWidth() {
        return process.stdout.columns || this.consoleWidth;
    }

    // Méthode pour afficher les informations en temps réel
    displaySystemStats() {
        if (this.profilerEnabled) {
            const cpuUsage = os.cpus().map(cpu => cpu.times);
            const ramUsage = {
                total: os.totalmem(),
                free: os.freemem(),
                used: os.totalmem() - os.freemem(),
            };
            const currentTime = new Date().toLocaleTimeString();

            const cpuUsageFormatted = `CPU: ${cpuUsage[0].user}%`;
            const ramUsageFormatted = `RAM: ${(ramUsage.used / ramUsage.total * 100).toFixed(1)}%`;
            const timeFormatted = `Time: ${currentTime}`;

            const info = `${cpuUsageFormatted} ${ramUsageFormatted} ${timeFormatted}`;
            const spaces = ' '.repeat(Math.max(0, this.getConsoleWidth() - info.length));

            this.clearLine();
            process.stdout.write(`${spaces}${info}\n`);
        }
    }

    // Reste de votre classe multiLang
}
module.exports = profiler;