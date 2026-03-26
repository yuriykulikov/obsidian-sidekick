export enum LogLevel {
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  USER = "USER",
  LOOP = "LOOP",
  CONTEXT = "CONTEXT",
  TOOL = "TOOL",
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  title?: string;
  markdown?: string;
  collapsed?: boolean;
}

export interface LogListener {
  onLog: (entry: LogEntry) => void;
  clear: () => void;
}

export class Logger {
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

  user(message: string) {
    this.log(LogLevel.USER, message);
  }

  loop(message: string) {
    this.log(LogLevel.LOOP, message);
  }

  tool(message: string) {
    this.log(LogLevel.TOOL, message);
  }

  warn(message: string) {
    this.log(LogLevel.WARN, message);
  }

  error(message: string) {
    this.log(LogLevel.ERROR, message);
  }

  markdown(
    title: string,
    markdown: string,
    level: LogLevel = LogLevel.INFO,
    collapsed: boolean = true,
  ) {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: level,
      message: title,
      title,
      markdown,
      collapsed,
    };
    this.logs.push(entry);
    this.notifyListeners(entry);
    console.debug(`[Sidekick][MARKDOWN] ${title}`);
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
      listener.onLog(entry);
    }
  }

  clear() {
    this.logs = [];
    for (const listener of this.listeners) {
      listener.clear();
    }
  }
}
