export declare class Cache {
    private cacheDir;
    constructor(cacheDir: string);
    get(namespace: string, id: string): object | undefined;
    set(namespace: string, id: string, obj: object): void;
    shouldUpdate(namespace: string, id: string, lastModifiedTime: number): boolean;
    fPath(namespace: string, id: string): string;
    private _hash;
}
//# sourceMappingURL=cache.d.ts.map