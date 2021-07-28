export declare class TemplateProvider {
    private templateDir;
    private templateMap;
    constructor(templateDir: string);
    /**
     * Get template as a string by its name.
     *
     * The name of a template is its filename without extension.
     */
    get(templateName: string): {
        content: string;
        filePath: string;
    };
    /**
     * Load a template as a string into cache and return it.
     *
     * If failed to load, return an error string.
     */
    private _load;
    /**
     * Get the path of a template file.
     */
    private _templatePath;
}
//# sourceMappingURL=template-provider.d.ts.map