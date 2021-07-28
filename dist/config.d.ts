export declare class Config {
    private configPath;
    private configObj;
    constructor(configPath: string);
    get(key: string): any;
    set(key: string, data: any): void;
    /** Sync changes to file. */
    sync(): Promise<void>;
}
//# sourceMappingURL=config.d.ts.map