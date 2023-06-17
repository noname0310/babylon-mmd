export interface ILogger {
    log(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}

export class ConsoleLogger implements ILogger {
    public log(message: string): void {
        console.log(message);
    }

    public warn(message: string): void {
        console.warn(message);
    }

    public error(message: string): void {
        console.error(message);
    }
}
