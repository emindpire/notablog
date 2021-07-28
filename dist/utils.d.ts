/**
 * Wrapper of console.log().
 */
export declare const log: any;
/**
 * Log a message to indicate a feature is being deprecated.
 * @param msg - The message.
 */
export declare function DEPRECATE(msg: string): void;
/**
 * Failsafe JSON.parse() wrapper.
 * @param str - Payload to parse.
 * @returns Parsed object when success, undefined when fail.
 */
export declare function parseJSON(str: any): object | undefined;
/**
 * Get the path of output dir and ensure it is available.
 * @param {string} workDir
 * @returns {string}
 */
export declare function outDir(workDir: any): string;
export declare function numToOrder(n: number): string;
/**
 * Make doing multi-layer object or array access like `obj.a.b.c.d` or
 * `arr[0][1][0][1]` more easily.
 *
 * Example Usage:
 *
 * In the constructor of {@link NDateTimeCell}, we want to access
 * a `NAST.DateTime` stored in a `NAST.SemanticString[]`.
 *
 * With vanilla JS, we would write:
 *
 * ```
 * something[0][1][0][1]
 * ```
 *
 * which is prone to get the error:
 *
 * ```
 * TypeError: Cannot read property '0' of undefined
 * ```
 *
 * We could use `try...catch...` to wrap it:
 *
 * ```
 * try {
 *   result = something[0][1][0][1]
 * } catch(error) {
 *   result = undefined
 * }
 * ```
 *
 * But with this helper function, we could simply write:
 *
 * ```
 * result = objAccess(something)(0)(1)(0)(1)()
 * ```
 *
 * However, note that the cost is that an `undefined` occurred in the
 * middle of the function call chain would be passed to the end
 * instead of stop execution.
 *
 * @param objLike - An object (or an array).
 */
export declare function objAccess(objLike: any): (key: string | number | undefined) => any;
//# sourceMappingURL=utils.d.ts.map