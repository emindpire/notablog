'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var fs = require('fs');
var path = require('path');
var notionapiAgent = require('notionapi-agent');
var taskManager = require('@dnpr/task-manager');
var fsutil = require('@dnpr/fsutil');
var crypto = require('crypto');
var logger = require('@dnpr/logger');
var nastUtilFromNotionapi = require('nast-util-from-notionapi');
var nastUtilToReact = require('nast-util-to-react');
var visit = require('unist-util-visit');
var child_process = require('child_process');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);
var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
var crypto__default = /*#__PURE__*/_interopDefaultLegacy(crypto);
var visit__default = /*#__PURE__*/_interopDefaultLegacy(visit);

/**
 * Wrapper of console.log().
 */
const log = new logger.Logger('notablog', {
    logLevel: typeof process.env.DEBUG !== 'undefined' ? 'debug' : 'info',
    useColor: typeof process.env.NO_COLOR !== 'undefined' ? false : true
});
/**
 * Get the path of output dir and ensure it is available.
 * @param {string} workDir
 * @returns {string}
 */
function outDir(workDir) {
    const outDir = path__default['default'].join(workDir, 'public');
    if (!fs__default['default'].existsSync(outDir)) {
        fs__default['default'].mkdirSync(outDir, { recursive: true });
    }
    return outDir;
}
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
function objAccess(objLike) {
    return function (key) {
        /** Call with no parameter to signal the end of the access chain. */
        if (typeof key === 'undefined') {
            return objLike;
        }
        /**
         * Try to access the array if it is truthy.
         * Otherwise, just pass the falsy value.
         */
        if (objLike) {
            return objAccess(objLike[key]);
        }
        else {
            return objAccess(objLike);
        }
    };
}

class Cache {
    cacheDir;
    constructor(cacheDir) {
        this.cacheDir = cacheDir;
        if (!fs__default['default'].existsSync(cacheDir)) {
            fs__default['default'].mkdirSync(cacheDir, { recursive: true });
        }
    }
    get(namespace, id) {
        const fPath = this.fPath(namespace, id);
        /** Read file. */
        if (!fs__default['default'].existsSync(fPath)) {
            log.debug(`Failed to get cache "${id}" of namespace "${namespace}".`);
            return undefined;
        }
        const data = fs__default['default'].readFileSync(fPath, { encoding: 'utf-8' });
        /** Parse file. */
        try {
            const obj = JSON.parse(data);
            return obj;
        }
        catch (error) {
            log.debug(`Cache object "${id}" of namespace "${namespace}" is corrupted.`);
            log.debug(error);
            return undefined;
        }
    }
    set(namespace, id, obj) {
        const fPath = this.fPath(namespace, id);
        fs__default['default'].writeFileSync(fPath, JSON.stringify(obj, getCircularReplacer()));
    }
    shouldUpdate(namespace, id, lastModifiedTime) {
        const fPath = this.fPath(namespace, id);
        if (fs__default['default'].existsSync(fPath)) {
            const lastModifiedTimeOfCache = fs__default['default'].statSync(fPath).mtimeMs;
            return lastModifiedTime > lastModifiedTimeOfCache;
        }
        else {
            return true;
        }
    }
    fPath(namespace, id) {
        return path__default['default'].join(this.cacheDir, this._hash(namespace + id));
    }
    _hash(payload) {
        return crypto__default['default'].createHash('sha256').update(payload).digest('hex');
    }
}
/**
 * Filter circular object for JSON.stringify()
 * @function getCircularReplacer
 * @returns {object} Filtered object.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Cyclic_object_value
 */
function getCircularReplacer() {
    const seen = new WeakSet();
    return (_key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
                return;
            }
            seen.add(value);
        }
        return value;
    };
}

class Config {
    configPath;
    configObj;
    constructor(configPath) {
        this.configPath = configPath;
        try {
            this.configObj =
                JSON.parse(fs__default['default'].readFileSync(configPath, { encoding: 'utf-8' }));
        }
        catch (error) {
            log.error(`Failed to load config from "${configPath}".`);
            throw (error);
        }
    }
    get(key) {
        return this.configObj[key];
    }
    set(key, data) {
        this.configObj[key] = data;
    }
    /** Sync changes to file. */
    sync() {
        return fs.promises.writeFile(this.configPath, JSON.stringify(this.configObj));
    }
}

class TemplateProvider {
    templateDir;
    templateMap;
    constructor(templateDir) {
        this.templateDir = templateDir;
        this.templateMap = {};
    }
    /**
     * Get template as a string by its name.
     *
     * The name of a template is its filename without extension.
     */
    get(templateName) {
        log.debug(`Get template "${templateName}"`);
        const template = this.templateMap[templateName];
        const templatePath = this._templatePath(templateName);
        if (typeof templateName !== 'string') {
            return {
                content: `"${templateName}" must be a string.`,
                filePath: templatePath
            };
        }
        if (template) {
            return { content: template, filePath: templatePath };
        }
        else {
            return { content: this._load(templateName), filePath: templatePath };
        }
    }
    /**
     * Load a template as a string into cache and return it.
     *
     * If failed to load, return an error string.
     */
    _load(templateName) {
        log.debug(`Load template "${templateName}"`);
        const templatePath = this._templatePath(templateName);
        try {
            this.templateMap[templateName] =
                fs__default['default'].readFileSync(templatePath, { encoding: 'utf-8' });
            return this.templateMap[templateName];
        }
        catch (err) {
            log.warn(err);
            if (templateName.length)
                return `Cannot find "${templateName}.html" \
in "${this.templateDir}".`;
            else
                return 'The template name has zero length, \
please check the "template" field in your Notion table.';
        }
    }
    /**
     * Get the path of a template file.
     */
    _templatePath(templateName) {
        return path__default['default'].join(this.templateDir, `${templateName}.html`);
    }
}

const dashIDLen = '0eeee000-cccc-bbbb-aaaa-123450000000'.length;
const noDashIDLen = '0eeee000ccccbbbbaaaa123450000000'.length;
function getPageIDFromCollectionPageURL(str) {
    let splitArr = str.split('/');
    splitArr = (splitArr.pop() || "").split('-');
    splitArr = (splitArr.pop() || "").split('?');
    let pageID = splitArr[0];
    if (pageID && pageID.length === noDashIDLen) {
        return toDashID(pageID);
    }
    else {
        throw new Error(`Cannot get pageID from ${str}`);
    }
}
function toDashID(str) {
    if (isValidDashID(str)) {
        return str;
    }
    let s = str.replace(/-/g, '');
    if (s.length !== noDashIDLen) {
        return str;
    }
    let res = str.substring(0, 8) + '-' + str.substring(8, 12) + '-' +
        str.substring(12, 16) + '-' + str.substring(16, 20) + '-' +
        str.substring(20);
    return res;
}
function isValidDashID(str) {
    if (str.length !== dashIDLen) {
        return false;
    }
    if (str.indexOf('-') === -1) {
        return false;
    }
    return true;
}

/**
 * Extract interested data for blog generation from a Notion table.
 */
async function parseTable(collectionPageURL, notionAgent) {
    const pageID = getPageIDFromCollectionPageURL(collectionPageURL);
    const pageCollection = (await nastUtilFromNotionapi.getOnePageAsTree(pageID, notionAgent));
    /**
     * Create map for property_name (column name) -> property_id (column id).
     * Notion uses random strings to identify columns because it allows users
     * to create multiple columns that have the same name.
     */
    const mapColNameToId = {};
    for (const [key, value] of Object.entries(pageCollection.schema)) {
        const colId = key;
        const colName = value.name;
        if (mapColNameToId[colName]) {
            log.warn(`Duplicate column name "${colName}", \
column with id "${colId}" is used`);
        }
        else {
            mapColNameToId[colName] = key;
        }
    }
    /**
     * Check if table has all required columns.
     *
     * - `title` is required by Notion.
     */
    const requiredCols = ['tags', 'publish', 'inMenu', 'inList', 'template', 'url', 'description', 'date', 'canonical'];
    for (const colName of requiredCols) {
        if (typeof pageCollection.schema[mapColNameToId[colName]] === 'undefined') {
            throw new Error(`Required column "${colName}" is missing in table.`);
        }
    }
    /**
     * Create map for tag -> color
     */
    const mapTagToColor = {};
    const classPrefix = '';
    (pageCollection.schema[mapColNameToId['tags']].options || []).forEach(tag => {
        mapTagToColor[tag.value] = `${classPrefix}${tag.color}`;
    });
    /** Remove empty rows */
    const validPages = pageCollection.children
        .filter(page => !!page.properties);
    const pageMetadatas = validPages
        .map(row => {
        return {
            id: (row.uri.split('/').pop() || '').split('?')[0],
            icon: row.icon,
            iconHTML: renderIconToHTML(row.icon),
            cover: row.cover,
            title: row.title,
            tags: getMultiSelect(row, mapColNameToId['tags']).map(tag => {
                return {
                    value: tag,
                    color: mapTagToColor[tag]
                };
            }),
            publish: getCheckbox(row, mapColNameToId['publish']),
            inMenu: getCheckbox(row, mapColNameToId['inMenu']),
            inList: getCheckbox(row, mapColNameToId['inList']),
            template: getSingleSelect(row, mapColNameToId['template']),
            url: getRealUrl(row, mapColNameToId['url']),
            canonical: getTextPlain(row, mapColNameToId['canonical']),
            description: getTextRaw(row, mapColNameToId['description']),
            descriptionPlain: getTextPlain(row, mapColNameToId['description']),
            descriptionHTML: getTextHTML(row, mapColNameToId['description']),
            date: getDateRaw(row, mapColNameToId['date']),
            dateString: getDateString(row, mapColNameToId['date']),
            createdTime: row.createdTime,
            lastEditedTime: row.lastEditedTime
        };
    });
    const siteContext = {
        icon: pageCollection.icon,
        iconHTML: renderIconToHTML(pageCollection.icon),
        cover: pageCollection.cover,
        title: pageCollection.name,
        description: pageCollection.description,
        descriptionPlain: renderStyledStringToTXT(pageCollection.description),
        descriptionHTML: renderStyledStringToHTML(pageCollection.description),
        /**
         * Sort the pages so that the most recent post is at the top.
         */
        pages: pageMetadatas.sort((later, former) => {
            const laterTimestamp = later.date
                ? (new Date(later.date)).getTime() : 0;
            const formerTimestamp = former.date
                ? (new Date(former.date)).getTime() : 0;
            if (laterTimestamp > formerTimestamp)
                return -1;
            else if (laterTimestamp < formerTimestamp)
                return 1;
            else
                return 0;
        }),
        tagMap: new Map()
    };
    /**
     * Create tagMap
     */
    siteContext.pages.forEach(page => {
        page.tags.forEach(tag => {
            if (!siteContext.tagMap.has(tag.value)) {
                siteContext.tagMap.set(tag.value, [page]);
            }
            else {
                siteContext.tagMap.get(tag.value).push(page);
            }
        });
    });
    return siteContext;
}
/**
 * Utility functions to get useful values from properties of Nast.Page
 */
/**
 * Get value of a checkbox-typed property
 * @param {Nast.Page} page
 * @param {string} propId
 * @returns {boolean}
 */
function getCheckbox(page, propId) {
    const prop = objAccess(page)('properties')(propId)();
    if (prop)
        return prop[0][0] === 'Yes';
    else
        return false;
}
/**
 * Get raw value of a text-typed property
 * @param {Nast.Page} page
 * @param {string} propId
 * @returns {Notion.StyledString[]}
 */
function getTextRaw(page, propId) {
    const prop = page.properties[propId];
    if (prop)
        return prop;
    else
        return [];
}
/**
 * Get plain string from a text-typed property
 * @param {Nast.Page} page
 * @param {string} propId
 * @returns {string}
 */
function getTextPlain(page, propId) {
    const prop = page.properties[propId];
    if (prop)
        return renderStyledStringToTXT(prop);
    else
        return '';
}
function renderStyledStringToTXT(styledStringArr) {
    if (styledStringArr)
        return styledStringArr.map(str => str[0]).join('');
    else
        return '';
}
/**
 * Get HTML string from a text-typed property
 * @param {Nast.Page} page
 * @param {string} propId
 * @returns {string}
 */
function getTextHTML(page, propId) {
    const prop = page.properties[propId];
    if (prop)
        return renderStyledStringToHTML(prop);
    else
        return '';
}
function renderStyledStringToHTML(styledStringArr) {
    if (styledStringArr)
        return nastUtilToReact.renderToHTML(styledStringArr);
    else
        return '';
}
/**
 * Get option array of a multi-select-typed property
 *
 * Raw options look like this:
 * { '<propId>': [ [ 'css,web' ] ] }
 * @param {Nast.Page} page
 * @param {string} propId
 * @returns {string[]}
 */
function getMultiSelect(page, propId) {
    const prop = page.properties[propId];
    if (prop)
        return prop[0][0].split(',');
    else
        return [];
}
/**
 * Get option of a single-select-typed property
 * @param {Nast.Page} page
 * @param {string} propId
 * @returns {string}
 */
function getSingleSelect(page, propId) {
    const options = getMultiSelect(page, propId);
    if (options.length > 0)
        return options[0];
    else
        return '';
}
/**
 * Get raw string of a date-typed property
 * @param {Nast.Page} page
 * @param {string} propId
 * @returns {string | undefined} YYYY-MM-DD
 */
function getDateRaw(page, propId) {
    return objAccess(page)('properties')(propId)(0)(1)(0)(1)('start_date')();
}
/**
 * Get formatted string from a date-typed property
 * @param {Nast.Page} page
 * @param {string} propId
 * @returns {string | undefined} WWW, MMM DD, YYY
 */
function getDateString(page, propId) {
    const dateRaw = getDateRaw(page, propId);
    if (dateRaw) {
        const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
        const dateString = (new Date(dateRaw)).toLocaleDateString('en-US', options);
        return dateString;
    }
    else
        return undefined;
}
/**
 * TODO: Use encodeURLComponent to completely eliminate XSS.
 *
 * Determine the string that will be used as the filename of the generated
 * HTML and as the URL to link in other pages.
 *
 * First, `/` and `\` are removed since they can't exist in file path.
 * Second, if the escaped url is a empty string or user doesn't specify an
 * url, use page id as the url.
 * @param {Nast.Page} page
 * @param {string} propId
 * @returns {string}
 */
function getRealUrl(page, propId) {
    const wantUrl = getTextPlain(page, propId);
    const safeUrl = getSafeUrl(wantUrl);
    const realUrl = (safeUrl.length > 0) ?
        `${safeUrl}.html` : `${page.uri.split('/').pop().split('?')[0]}.html`;
    return realUrl;
}
/**
 * Remove "/" and "\" since they can't be in filename
 * @param {string} url
 * @returns {string}
 */
function getSafeUrl(url) {
    return url.replace(/\/|\\/g, '');
}
/**
 * If the icon is an url, wrap it with `<img>`.
 * @param {string} icon
 */
function renderIconToHTML(icon) {
    const re = /^http/;
    if (re.test(icon)) {
        return `<span><img class="inline-img-icon" src="${icon}"></span>`;
    }
    else {
        return icon ? `<span>${icon}</span>` : '';
    }
}

const Sqrl$1 = require('squirrelly');
function renderIndex(task) {
    const siteMeta = task.data.siteMeta;
    const templateProvider = task.tools.templateProvider;
    const config = task.config;
    const outDir = config.outDir;
    const indexPath = path__default['default'].join(outDir, 'index.html');
    Sqrl$1.autoEscaping(false);
    log.info('Render home page');
    const html = Sqrl$1.Render(templateProvider.get('index').content, {
        siteMeta
    });
    fs__default['default'].writeFileSync(indexPath, html, { encoding: 'utf-8' });
    siteMeta.tagMap.forEach((pageMetas, tagVal) => {
        log.info(`Render tag "${tagVal}"`);
        const html = Sqrl$1.Render(templateProvider.get('tag').content, {
            siteMeta,
            tagName: tagVal,
            pages: pageMetas
        });
        fs__default['default'].writeFileSync(`${config.tagDir}/${tagVal}.html`, html, { encoding: 'utf-8' });
    });
}

var fsPromises = fs__default['default'].promises;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Sqrl = require('squirrelly');
function createLinkTransformer(siteContext) {
    /** Get no dash page id. */
    function getPageIdFromUri(uri) {
        return uri.split('/').pop();
    }
    /** Replace internal links for a node. */
    return function (node, _index, parent) {
        /** Skip root. */
        if (!parent)
            return;
        /** Link to page. */
        if (node.type === 'page') {
            const pageId = getPageIdFromUri(node.uri);
            if (!pageId)
                return;
            const page = siteContext.pages.find(page => page.id === pageId);
            if (!page)
                return;
            log.debug(`Replace link: ${node.uri} -> ${page.url}`);
            node.uri = page.url;
            return;
        }
        /** Inline mention or link. */
        /** `node` may be any block with text, specifying text block here is
            to eliminate type errors.  */
        const richTextStrs = node.title || [];
        for (let i = 0; i < richTextStrs.length; i++) {
            const richTextStr = richTextStrs[i];
            /** Inline mention page. */
            if ('‣' === richTextStr[0] && 'p' === objAccess(richTextStr)(1)(0)(0)()) {
                const pageInline = objAccess(richTextStr)(1)(0)(1)();
                if (!pageInline)
                    continue;
                const pageId = getPageIdFromUri(pageInline.uri);
                if (!pageId)
                    continue;
                const page = siteContext.pages.find(page => page.id === pageId);
                if (page) {
                    log.debug(`Replace link: ${pageInline.uri} -> ${page.url}`);
                    pageInline.uri = page.url;
                }
                else {
                    const newLink = `https://www.notion.so/${pageId}`;
                    pageInline.uri = newLink;
                    log.debug(`Replace link: ${pageInline.uri} -> ${newLink}`);
                }
                continue;
            }
            if (Array.isArray(richTextStr[1]))
                richTextStr[1].forEach(mark => {
                    if ('a' === mark[0]) {
                        /** Inline link to page or block. */
                        /**
                         * Link to a page:
                         * '/65166b7333374374b13b040ca1599593'
                         *
                         * Link to a block in a page:
                         * '/ec83369b2a9c438093478ddbd8da72e6#aa3f7c1be80d485499910685dee87ba9'
                         *
                         * Link to a page in a collection view, the page is opened in
                         * preview mode (not supported):
                         * '/595365eeed0845fb9f4d641b7b845726?v=a1cb648704784afea1d5cdfb8ac2e9f0&p=65166b7333374374b13b040ca1599593'
                         */
                        const toPath = mark[1];
                        if (!toPath)
                            return;
                        /** Ignore non-notion-internal links. */
                        if (!toPath.startsWith('/'))
                            return;
                        /** Ignore unsupported links. */
                        if (toPath.includes('?')) {
                            const newPath = `https://www.notion.so${toPath}`;
                            log.debug(`Replace link: ${toPath} -> ${newPath}`);
                            mark[1] = newPath;
                            return;
                        }
                        const ids = toPath.replace(/\//g, '').split('#');
                        if (ids.length > 0) {
                            const targetPage = ids[0];
                            const targetBlock = ids[1];
                            const pageInfo = siteContext.pages.find(page => page.id === targetPage);
                            if (pageInfo) {
                                /** The page is in the table. */
                                const newLink = `${pageInfo.url}${targetBlock ? '#https://www.notion.so/' + targetBlock : ''}`;
                                mark[1] = newLink;
                            }
                            else {
                                /** The page is not in the table. */
                                const newLink = `https://www.notion.so${toPath}`;
                                mark[1] = newLink;
                            }
                            log.debug(`Replace link: ${toPath} -> ${mark[1]}`);
                            return;
                        }
                    }
                });
        }
        return;
    };
}
/**
 * Render a post.
 * @param task
 */
async function renderPost(task) {
    const siteContext = task.data.siteContext;
    const templateProvider = task.tools.templateProvider;
    const notionAgent = task.tools.notionAgent;
    const cache = task.tools.cache;
    const pageMetadata = task.data.pageMetadata;
    const config = task.config;
    const pageID = toDashID(pageMetadata.id);
    let nast;
    /** Fetch page. */
    if (config.doFetchPage) {
        log.info(`Fetch data of page "${pageID}"`);
        nast = await nastUtilFromNotionapi.getOnePageAsTree(pageID, notionAgent);
        /** Use internal links for pages in the table. */
        /** @ts-ignore */
        visit__default['default'](nast, createLinkTransformer(siteContext));
        cache.set('notion', pageID, nast);
        log.info(`Cache of "${pageID}" is saved`);
    }
    else {
        log.info(`Read cache of page "${pageID}"`);
        const _nast = cache.get('notion', pageID);
        if (_nast != null)
            nast = _nast;
        else
            throw new Error(`\
Cache of page "${pageID}" is corrupted, delete cache/ to rebuild`);
    }
    /** Render with template. */
    if (pageMetadata.publish) {
        log.info(`Render page "${pageID}"`);
        const contentHTML = nastUtilToReact.renderToHTML(nast);
        const outDir = config.outDir;
        const postPath = path__default['default'].join(outDir, pageMetadata.url);
        Sqrl.autoEscaping(false);
        const html = Sqrl.Render(templateProvider.get(pageMetadata.template).content, {
            siteMeta: siteContext,
            post: {
                ...pageMetadata,
                contentHTML
            }
        });
        await fsPromises.writeFile(postPath, html, { encoding: 'utf-8' });
        return 0;
    }
    else {
        log.info(`Skip rendering of unpublished page "${pageID}"`);
        return 1;
    }
}

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
async function generate(workDir, opts = {}) {
    const concurrency = opts.concurrency;
    const verbose = opts.verbose;
    const ignoreCache = opts.ignoreCache;
    const notionAgent = notionapiAgent.createAgent({ debug: verbose });
    const cache = new Cache(path__default['default'].join(workDir, 'cache'));
    const config = new Config(path__default['default'].join(workDir, 'config.json'));
    /** Init dir paths. */
    const theme = config.get('theme');
    const themeDir = path__default['default'].join(workDir, `themes/${theme}`);
    if (!fs__default['default'].existsSync(themeDir)) {
        throw new Error(`Cannot find "${theme}" in themes/ folder`);
    }
    const outDir = path__default['default'].join(workDir, 'public');
    if (!fs__default['default'].existsSync(outDir)) {
        fs__default['default'].mkdirSync(outDir, { recursive: true });
    }
    const tagDir = path__default['default'].join(workDir, 'public/tag');
    if (!fs__default['default'].existsSync(tagDir)) {
        fs__default['default'].mkdirSync(tagDir, { recursive: true });
    }
    const dirs = {
        workDir, themeDir, outDir, tagDir
    };
    /** Create TemplateProvider instance. */
    const templateDir = path__default['default'].join(themeDir, 'layout');
    const templateProvider = new TemplateProvider(templateDir);
    /** Copy theme assets. */
    log.info('Copy theme assets');
    const assetDir = path__default['default'].join(themeDir, 'assets');
    fsutil.copyDirSync(assetDir, outDir);
    /** Fetch site metadata. */
    log.info('Fetch Site Metadata');
    const siteContext = await parseTable(config.get('url'), notionAgent);
    /** Render site entry. */
    log.info('Render site entry');
    renderIndex({
        data: {
            siteMeta: siteContext
        },
        tools: {
            templateProvider
        },
        config: {
            ...dirs
        }
    });
    /** Render pages. */
    log.info('Fetch and render pages');
    const { pagesUpdated, pagesNotUpdated } = siteContext.pages
        .reduce((data, page) => {
        if (ignoreCache || cache.shouldUpdate('notion', toDashID(page.id), page.lastEditedTime)) {
            data.pagesUpdated.push(page);
        }
        else {
            data.pagesNotUpdated.push(page);
        }
        return data;
    }, {
        pagesUpdated: [], pagesNotUpdated: []
    });
    const pageTotalCount = siteContext.pages.length;
    const pageUpdatedCount = pagesUpdated.length;
    const pagePublishedCount = siteContext.pages
        .filter(page => page.publish).length;
    log.info(`${pageUpdatedCount} of ${pageTotalCount} posts have been updated`);
    log.info(`${pagePublishedCount} of ${pageTotalCount} posts are published`);
    const tm2 = new taskManager.TaskManager2({ concurrency });
    const tasks = [];
    pagesUpdated.forEach(pageMetadata => {
        tasks.push(tm2.queue(renderPost, [{
                data: {
                    siteContext, pageMetadata
                },
                tools: {
                    templateProvider, notionAgent, cache
                },
                config: {
                    ...dirs,
                    doFetchPage: true
                }
            }]));
    });
    pagesNotUpdated.forEach(pageMetadata => {
        tasks.push(tm2.queue(renderPost, [{
                data: {
                    siteContext, pageMetadata
                },
                tools: {
                    templateProvider, notionAgent, cache
                },
                config: {
                    ...dirs,
                    doFetchPage: false
                }
            }]));
    });
    await Promise.all(tasks);
    return 0;
}

/**
 * Open `index` with `bin`.
 * @see https://nodejs.org/api/child_process.html#child_process_options_detached
 * @param {string} bin
 * @param {string} index
 */
function open(bin, index) {
    const p = child_process.spawn(bin, [index], { detached: true, stdio: 'ignore' });
    p.unref();
}
/**
 * Preview the generate blog.
 * @param {string} workDir
 */
function preview(workDir) {
    const c = new Config(path__default['default'].join(workDir, 'config.json'));
    if (c.get('previewBrowser')) {
        open(c.get('previewBrowser'), path__default['default'].join(outDir(workDir), 'index.html'));
    }
    else {
        throw new Error('"previewBrowser" property is not set in your Notablog config file.');
    }
}

exports.generate = generate;
exports.preview = preview;
//# sourceMappingURL=index.js.map
