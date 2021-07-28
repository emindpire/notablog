export interface RenderStrategy {
    render: (templateName: string, data: any) => string;
}
export declare class EJSStrategy implements RenderStrategy {
    private templateProvider;
    constructor(templateDir: string);
    render(templateName: any, data: any): any;
}
export declare class SqrlStrategy implements RenderStrategy {
    private templateProvider;
    constructor(templateDir: string);
    render(templateName: any, data: any): any;
}
export declare class Renderer {
    private strategy;
    constructor(strategy: RenderStrategy);
    render(templateName: string, data: object): string;
}
//# sourceMappingURL=renderer.d.ts.map