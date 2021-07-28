declare type SelectOption = {
    id: string;
    color: Notion.Collection.ColumnPropertyOptionColor;
    value: string;
};
interface Property {
    id: string;
    type: string;
    records: Map<Record, Cell>;
}
interface Record {
    id: string;
    properties: Map<Property, Cell>;
}
interface Cell {
    property: Property;
    record: Record;
}
interface Table {
    id: string;
    schema: Property[];
    records: Record[];
}
declare class NProperty implements Property {
    id: string;
    type: string;
    records: Map<NRecord, NCell>;
    name: string;
    constructor(id: string, rawProperty: Notion.Collection.ColumnProperty);
}
declare class NTextProperty extends NProperty {
    type: 'text';
    constructor(id: string, rawProperty: Notion.Collection.ColumnProperty);
}
declare class NCheckboxProperty extends NProperty {
    type: 'checkbox';
    constructor(id: string, rawProperty: Notion.Collection.ColumnProperty);
}
declare class NSelectProperty extends NProperty {
    type: 'select';
    options: SelectOption[];
    constructor(id: string, rawProperty: Notion.Collection.ColumnProperty);
}
declare class NMultiSelectProperty extends NProperty {
    type: 'multi_select';
    options: SelectOption[];
    constructor(id: string, rawProperty: Notion.Collection.ColumnProperty);
}
declare class NDateTimeProperty extends NProperty {
    type: 'date';
    constructor(id: string, rawProperty: Notion.Collection.ColumnProperty);
}
declare type NPropertyUnion = NTextProperty | NCheckboxProperty | NSelectProperty | NMultiSelectProperty | NDateTimeProperty;
declare class NRecord implements Record {
    id: string;
    properties: Map<NPropertyUnion, NCellUnion>;
    uri: NAST.URI;
    title: NAST.SemanticString[];
    icon?: NAST.Emoji | NAST.PublicUrl;
    cover?: NAST.PublicUrl;
    coverPosition: number;
    fullWidth: boolean;
    constructor(rawPage: NAST.Page);
}
declare class NCell implements Cell {
    property: NProperty;
    record: NRecord;
    constructor(property: NProperty, record: NRecord);
}
declare class NTextCell extends NCell {
    value: NAST.SemanticString[];
    constructor(property: NTextProperty, record: NRecord, rawValue: NAST.SemanticString[]);
}
declare class NCheckboxCell extends NCell {
    value: boolean;
    constructor(property: NCheckboxProperty, record: NRecord, rawValue: NAST.SemanticString[]);
}
declare class NSelectCell extends NCell {
    value: SelectOption | undefined;
    constructor(property: NSelectProperty, record: NRecord, rawValue: NAST.SemanticString[]);
}
declare class NMultiSelectCell extends NCell {
    value: SelectOption[];
    constructor(property: NMultiSelectProperty, record: NRecord, rawValue: NAST.SemanticString[]);
}
declare class NDateTimeCell extends NCell {
    value: NAST.DateTime | undefined;
    constructor(property: NDateTimeProperty, record: NRecord, rawValue: NAST.SemanticString[]);
}
declare type NCellUnion = NTextCell | NCheckboxCell | NSelectCell | NMultiSelectCell | NDateTimeCell;
export declare class NTable implements Table {
    id: string;
    schema: NPropertyUnion[];
    records: NRecord[];
    constructor(rawTable: NAST.Collection);
    /** Print the table structure so you can see what it looks like. */
    peekStructure(): void;
}
export {};
//# sourceMappingURL=ntable.d.ts.map