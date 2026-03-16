export enum LogLevel {
	INFO = "INFO",
	ERROR = "ERROR",
}

export interface LogEntry {
	timestamp: Date;
	level: LogLevel;
	message: string;
}

export type LogListener = (entry: LogEntry) => void;

export class SidekickLogger {
	private logs: LogEntry[] = [];
	private listeners: LogListener[] = [];

	log(level: LogLevel, message: string) {
		const entry: LogEntry = {
			timestamp: new Date(),
			level,
			message,
		};
		this.logs.push(entry);
		this.notifyListeners(entry);
		console.debug(`[Sidekick][${level}] ${message}`);
	}

	info(message: string) {
		this.log(LogLevel.INFO, message);
	}

	error(message: string) {
		this.log(LogLevel.ERROR, message);
	}

	getLogs(): LogEntry[] {
		return [...this.logs];
	}

	addListener(listener: LogListener) {
		this.listeners.push(listener);
	}

	removeListener(listener: LogListener) {
		this.listeners = this.listeners.filter((l) => l !== listener);
	}

	private notifyListeners(entry: LogEntry) {
		for (const listener of this.listeners) {
			listener(entry);
		}
	}

	clear() {
		this.logs = [];
	}
}
