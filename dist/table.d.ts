interface PropertyValue {
    type: Notion.Collection.ColumnPropertyType;
    value: any;
    groupKeys?: string[];
}
export interface ISchema {
    idPropertyMap: {
        [key in Notion.Collection.ColumnID]: Notion.Collection.ColumnProperty;
    };
    nameIdsMap: {
        [key in Notion.Collection.ColumnProperty['name']]: Notion.Collection.ColumnID[];
    };
    lookupIdsByName: (name: string) => Notion.Collection.ColumnID[];
}
export interface IRecord {
    uri: NAST.URI;
    title: NAST.SemanticString[];
    icon?: NAST.Emoji | NAST.PublicUrl;
    cover?: NAST.PublicUrl;
    coverPosition: number;
    fullWidth: boolean;
    schema: Schema;
    getPropertyValueById: (id: Notion.Collection.ColumnID) => PropertyValue | undefined;
    getPropertyValuesByName: (name: Notion.Collection.ColumnProperty['name']) => PropertyValue[];
}
export interface ITable {
    uri: NAST.URI;
    name: NAST.SemanticString[];
    description?: NAST.SemanticString[];
    icon?: NAST.Emoji | NAST.PublicUrl;
    cover?: NAST.PublicUrl;
    coverPosition: number;
    schema: Schema;
    records: Record[];
}
export declare class Schema implements ISchema {
    idPropertyMap: {
        [key in Notion.Collection.ColumnID]: Notion.Collection.ColumnProperty;
    };
    nameIdsMap: {
        [key in Notion.Collection.ColumnProperty['name']]: Notion.Collection.ColumnID[];
    };
    constructor(rawSchema: NAST.Collection['schema']);
    lookupIdsByName(name: string): string[];
}
export declare class Record implements IRecord {
    uri: NAST.URI;
    title: NAST.SemanticString[];
    icon?: NAST.Emoji | NAST.PublicUrl;
    cover?: NAST.PublicUrl;
    coverPosition: number;
    fullWidth: boolean;
    schema: Schema;
    private _rawRecord;
    constructor(rawRecord: NAST.Page, schema: Schema);
    /** A property has an unique id. */
    getPropertyValueById(id: Notion.Collection.ColumnID): PropertyValue | undefined;
    /** Properties may have the same name. */
    getPropertyValuesByName(name: Notion.Collection.ColumnProperty['name']): PropertyValue[];
}
export declare class Table implements ITable {
    uri: NAST.URI;
    name: NAST.SemanticString[];
    description?: NAST.SemanticString[];
    icon?: NAST.Emoji | NAST.PublicUrl;
    cover?: NAST.PublicUrl;
    coverPosition: number;
    schema: Schema;
    records: Record[];
    constructor(rawTable: NAST.CollectionPage);
    recordsGroupByProperty(propertyName: string, which?: number): {
        groups: {
            [key: string]: Record[];
        };
        ungrouped: Record[];
    };
}
export {};
//# sourceMappingURL=table.d.ts.map