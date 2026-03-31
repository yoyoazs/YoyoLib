'use strict';

const os       = require('os');
const readline = require('readline');

class Profiler {
    constructor() {
        this.profilerEnabled  = false;
        this.consoleWidth     = process.stdout.columns || 80;
        this._profilerInterval = null;
        this._prevCpuTimes    = null;  // Previous CPU snapshot for delta calculation
    }

    /**
     * Enables the profiler and starts displaying real-time system stats.
     */
    enableProfiler() {
        this.profilerEnabled = true;
        this._prevCpuTimes   = this._getCpuTimes();
        this._startProfiler();
    }

    /**
     * Disables the profiler and stops the display.
     */
    disableProfiler() {
        this.profilerEnabled = false;
        this._stopProfiler();
    }

    /**
     * Returns whether the profiler is currently running.
     * @returns {boolean}
     */
    isEnabled() {
        return this.profilerEnabled;
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    /**
     * Starts the display interval (every 2 seconds).
     * @private
     */
    _startProfiler() {
        this._profilerInterval = setInterval(() => {
            this._displaySystemStats();
        }, 2000);
    }

    /**
     * Stops the display interval and clears the last line.
     * @private
     */
    _stopProfiler() {
        if (this._profilerInterval) {
            clearInterval(this._profilerInterval);
            this._profilerInterval = null;
        }
        this._clearLine();
    }

    /**
     * Clears the current console line using readline.
     * @private
     */
    _clearLine() {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
    }

    /**
     * Returns the current width of the terminal.
     * @private
     * @returns {number}
     */
    _getConsoleWidth() {
        return process.stdout.columns || this.consoleWidth;
    }

    /**
     * Takes a snapshot of all CPU core times.
     * @private
     * @returns {{ user: number, sys: number, idle: number }}
     */
    _getCpuTimes() {
        const cpus = os.cpus();
        let user = 0, sys = 0, idle = 0;
        for (const cpu of cpus) {
            user += cpu.times.user;
            sys  += cpu.times.sys + cpu.times.irq + cpu.times.nice;
            idle += cpu.times.idle;
        }
        return { user, sys, idle };
    }

    /**
     * Computes the CPU usage percentage between two snapshots.
     * @private
     * @returns {string} - e.g. "12.3"
     */
    _getCpuPercent() {
        const current = this._getCpuTimes();
        const prev    = this._prevCpuTimes;

        const deltaUser  = current.user - prev.user;
        const deltaSys   = current.sys  - prev.sys;
        const deltaIdle  = current.idle - prev.idle;
        const deltaTotal = deltaUser + deltaSys + deltaIdle;

        this._prevCpuTimes = current;

        if (deltaTotal === 0) return '0.0';
        return ((1 - deltaIdle / deltaTotal) * 100).toFixed(1);
    }

    /**
     * Writes the real-time stats line to stdout.
     * @private
     */
    _displaySystemStats() {
        if (!this.profilerEnabled) return;

        const cpuPercent = this._getCpuPercent();
        const ramTotal   = os.totalmem();
        const ramUsed    = ramTotal - os.freemem();
        const ramPercent = ((ramUsed / ramTotal) * 100).toFixed(1);
        const uptime     = this._formatUptime(os.uptime());
        const time       = new Date().toLocaleTimeString();

        const info    = `CPU: ${cpuPercent}%  RAM: ${ramPercent}%  Uptime: ${uptime}  ${time}`;
        const padding = ' '.repeat(Math.max(0, this._getConsoleWidth() - info.length));

        this._clearLine();
        process.stdout.write(`${padding}${info}\n`);
    }

    /**
     * Formats a number of seconds into HH:MM:SS.
     * @private
     * @param {number} seconds
     * @returns {string}
     */
    _formatUptime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
    }
}

module.exports = Profiler;