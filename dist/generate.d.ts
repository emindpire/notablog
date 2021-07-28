declare type GenerateOptions = {
    concurrency?: number;
    verbose?: boolean;
    ignoreCache?: boolean;
};
/**
 * @typedef {Object} GenerateOptions
 * @property {string} workDir - A valid Notablog starter directory.
 * @property {number} concurrency - Concurrency for Notion page
 * downloading and rendering.
 * @property {boolean} verbose - Whether to print more messages for
 * debugging.
 */
/**
 * Generate a blog.
 */
export declare function generate(workDir: string, opts?: GenerateOptions): Promise<number>;
export {};
//# sourceMappingURL=generate.d.ts.map