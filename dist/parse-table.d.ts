import { createAgent } from 'notionapi-agent';
import { SiteContext } from './types';
/**
 * Extract interested data for blog generation from a Notion table.
 */
export declare function parseTable(collectionPageURL: string, notionAgent: ReturnType<typeof createAgent>): Promise<SiteContext>;
//# sourceMappingURL=parse-table.d.ts.map