import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

export class HarAnalyzer {
    constructor() {
        this.groups = {};
        this.rules = {
            'has-unexpected-404-response': 'warning',
            'no-valid-title-found': 'warning',
            'no-valid-h1-found': 'warning',
            'no-valid-text-found': 'error',
            'invalid-text-found': 'warning',
            'no-valid-response-status-code': 'error',
            'no-unsupported-locale-use': 'warning',
            'no-valid-not-found-text-in-body': 'warning',
            'no-network': 'warning'
        };

        const libFolder = fileURLToPath(new URL('..', import.meta.url));
        this.pluginFolder = path.resolve(libFolder, '..');
        this.locales = this.loadLocales(path.resolve(libFolder, 'locale'));
        const packagePath = path.resolve(libFolder, 'package.json');
        this.package = JSON.parse(readFileSync(packagePath, 'utf8'));
        this.dependencies = this.package.dependencies;
        this.version = this.package.version;
    }
    // Reads every locale/<code>.json into { code: [lowercase phrases] }.
    loadLocales(localeFolder) {
        const locales = {};
        if (!fs.existsSync(localeFolder)) {
            return locales;
        }
        for (const file of fs.readdirSync(localeFolder)) {
            if (!file.endsWith('.json')) {
                continue;
            }
            const code = file.slice(0, -'.json'.length).toLowerCase();
            const data = JSON.parse(readFileSync(path.join(localeFolder, file), 'utf8'));
            const phrases = data['valid-not-found-texts'] || [];
            locales[code] = [...new Set(phrases.map(text => text.toLowerCase()))];
        }
        return locales;
    }

    // Maps the value of <html lang> to a locale code: the primary language
    // subtag in lowercase ("de-DE" -> "de"), with the Norwegian written
    // forms mapped to the "no" locale. Returns undefined when lang is missing.
    getLocaleCode(langAttribute) {
        if (typeof langAttribute !== 'string') {
            return undefined;
        }
        const primary = langAttribute.trim().toLowerCase().split(/[-_]/)[0];
        if (primary === '') {
            return undefined;
        }
        if (primary === 'nb' || primary === 'nn') {
            return 'no';
        }
        return primary;
    }

    // Case-insensitive check that the text contains at least one of the
    // phrases a page not found page is expected to show. Typographic
    // apostrophes are normalised so that "n’existe pas" matches "existe pas".
    hasNotFoundText(text, phrases) {
        const normalised = (text || '').toLowerCase().replace(/[\u2019\u02BC]/g, "'");
        return phrases.some(phrase => normalised.includes(phrase));
    }

    getAnalyzableUrl(url, uuid, group) {
        if (this.groups[group] !== undefined) {
            // Only test it once for every group
            return undefined;
        }
        const urlObj = new URL(url);
        const tmpPath = uuid.substring(0, 5);
        let path = `${tmpPath}/finns-det-en-sida/pa-den-har-adressen/testanrop/`;

        if ((urlObj.pathname.length + path.length) < 200) {
            if (urlObj.pathname.endsWith('/')) {
                path = `${urlObj.pathname}${path}`;
            } else {
                path = `${urlObj.pathname}/${path}`;
            }
        }

        urlObj.pathname = path;
        const test_url = urlObj.toString();
        this.groups[group] = {
            'page-not-found-url': test_url
        }
        return test_url;
    }

    getFirstPageEntries(url, harData) {
        if ('log' in harData) {
            harData = harData['log'];
        }

        const entries = harData.entries;
        if (!Array.isArray(entries)) {
            return [];
        }

        // A HAR can contain more than one page, for example when a concurrent
        // browsertime run ends up in the same browser session (crossed DevTools
        // port) and navigates to another website mid-recording. Requests made
        // by other pages must not be attributed to the tested website, and if
        // the recording doesn't even start with the tested website nothing in
        // it can be trusted.
        if (url && entries.length > 0) {
            const firstUrl = entries[0].request && entries[0].request.url;
            if (firstUrl) {
                try {
                    if (new URL(firstUrl).hostname !== new URL(url).hostname) {
                        return [];
                    }
                } catch {
                    // Unparsable URLs are handled by the entry loops as before
                }
            }
        }

        const pages = harData.pages;
        if (!Array.isArray(pages) || pages.length === 0) {
            return entries;
        }
        const firstPageId = pages[0].id;
        if (firstPageId === undefined) {
            return entries;
        }
        return entries.filter(entry =>
            entry.pageref === undefined || entry.pageref === firstPageId);
    }

    transform2SimplifiedData(url, harData) {
        const data = {
            'page': undefined,
            '404s': []
        };

        let reqIndex = 1;
        let hasPage = false;

        for (const entry of this.getFirstPageEntries(url, harData)) {
            const req = entry.request;
            const res = entry.response;
            const reqUrl = req.url;

            if (!res.content || !res.content.mimeType || !res.content.size || res.content.size <= 0 || !res.status) {
                continue;
            }

            if (!hasPage && res.content.mimeType.includes('html')) {
                data.page = {
                    url: reqUrl,
                    content: res.content.text,
                    status: res.status,
                    index: reqIndex
                };
                hasPage = true;
            } else {
                if (res.status === 404) {

                    data['404s'].push(reqUrl)
                }
            }

            reqIndex++;
        }
        return data;
    }

    addIssuesFromKnowledgeData(knowledgeData) {
        const url = knowledgeData['url'];
        if (!('is-page-not-found-page' in knowledgeData)) {
            if (knowledgeData['other-404-responses'].length > 0) {
                knowledgeData['issues']['has-unexpected-404-response'] = {
                    'test': '404',
                    rule: 'has-unexpected-404-response',
                    category: 'standard',
                    severity: 'warning',
                    'subIssues': [{
                        url: url,
                        rule: 'has-unexpected-404-response',
                        category: 'standard',
                        text: `Unexpected 404 response(s) found`,
                        severity: 'warning'
                    }]
                };
            }
            return;
        }

        if (!knowledgeData['page-title'] || knowledgeData['page-title'].length < 1) {
            knowledgeData['issues']['no-valid-title-found'] = {
                'test': '404',
                rule: 'no-valid-title-found',
                category: 'standard',
                severity: 'warning',
                'subIssues': [{
                    url: url,
                    rule: 'no-valid-title-found',
                    category: 'standard',
                    text: 'No valid page title found',
                    severity: 'warning',
                }]
            };
        }
        if (!knowledgeData['h1'] || knowledgeData['h1'].length < 1) {
            knowledgeData['issues']['no-valid-h1-found'] = {
                'test': '404',
                rule: 'no-valid-h1-found',
                category: 'standard',
                severity: 'warning',
                'subIssues': [{
                    url: url,
                    rule: 'no-valid-h1-found',
                    category: 'standard',
                    text: 'No valid H1 found',
                    severity: 'warning',
                }]
            };
        }
        if (!knowledgeData['body-text']) {
            knowledgeData['issues']['no-valid-text-found'] = {
                'test': '404',
                rule: 'no-valid-text-found',
                category: 'standard',
                severity: 'error',
                'subIssues': [{
                    url: url,
                    rule: 'no-valid-text-found',
                    category: 'standard',
                    text: 'No valid body text found',
                    severity: 'error',
                }]
            };
        }
        else if (knowledgeData['body-text'].length < 150) {
            knowledgeData['issues']['invalid-text-found'] = {
                'test': '404',
                rule: 'invalid-text-found',
                category: 'standard',
                severity: 'warning',
                'subIssues': [{
                    url: url,
                    rule: 'invalid-text-found',
                    category: 'standard',
                    text: 'body text found is too short',
                    severity: 'warning',
                }]
            };
        }
        if (knowledgeData['status-code'] !== 404) {
            knowledgeData['issues']['no-valid-response-status-code'] = {
                'test': '404',
                rule: 'no-valid-response-status-code',
                category: 'standard',
                severity: 'error',
                'subIssues': [{
                    url: url,
                    rule: 'no-valid-response-status-code',
                    category: 'standard',
                    text: 'Response status code is not 404',
                    severity: 'error',
                }]
            };
        }


        // Pick the phrase list for the page's language. A page without a
        // lang attribute is checked against every locale we have. A page in
        // a language we have no locale for gets no-unsupported-locale-use
        // and is also checked against every locale, so that an English or
        // multilingual page not found page can still pass.
        const lang = knowledgeData['lang'];
        let phrases;
        if (lang === undefined) {
            phrases = Object.values(this.locales).flat();
        } else if (lang in this.locales) {
            phrases = this.locales[lang];
        } else {
            phrases = Object.values(this.locales).flat();
            knowledgeData['issues']['no-unsupported-locale-use'] = {
                'test': '404',
                rule: 'no-unsupported-locale-use',
                category: 'standard',
                severity: 'warning',
                'subIssues': [{
                    url: url,
                    rule: 'no-unsupported-locale-use',
                    category: 'standard',
                    severity: 'warning',
                    text: `No phrase list for language "${lang}", checked against all ${Object.keys(this.locales).length} languages instead`
                }]
            };
        }
        // Some sites put the only error wording in the title or the h1,
        // so those are checked together with the body text.
        const textToCheck = [knowledgeData['page-title'], knowledgeData['h1'], knowledgeData['body-text']]
            .filter(Boolean).join(' ');
        if (!this.hasNotFoundText(textToCheck, phrases)) {
            knowledgeData['issues']['no-valid-not-found-text-in-body'] = {
                'test': '404',
                rule: 'no-valid-not-found-text-in-body',
                category: 'standard',
                severity: 'warning',
                'subIssues': [{
                    url: url,
                    rule: 'no-valid-not-found-text-in-body',
                    category: 'standard',
                    severity: 'warning',
                }]
            };
        }

        // Add missing rules from securityConfig and standardConfig
        const allRules = [
            ...Object.keys(this.rules || {}).filter(rule => this.rules[rule] !== "off")
        ];

        for (const rule of allRules) {
            if (!knowledgeData.issues[rule]) {
                knowledgeData.issues[rule] = {
                    'test': '404',
                    rule: rule,
                    category: 'standard',
                    severity: 'resolved', // Default severity for missing issues
                    subIssues: []
                };
            }
        }

    }

    async createKnowledgeFromData(analyzedData, url, group) {
        let knowledgeData = {
            'url': url,
            'group': group,
            'issues': {},
            'lang': undefined,
            'page-title': undefined,
            'h1': undefined,
            'body-text': undefined,
            'status-code': undefined,
            'other-404-responses': []
        };

        if (analyzedData === undefined) {
            return knowledgeData;
        }

        if (!('page' in analyzedData) || !analyzedData['page']) {
            knowledgeData['issues']['no-network'] = {
                'test': '404',
                'rule': 'no-network',
                'category': 'technical',
                'severity': 'warning',
                'subIssues': [
                    {
                        'url': url,
                        'rule': 'no-network',
                        'category': 'standard',
                        'severity': 'warning',
                        'text': `No HTML content found in the HAR file.`,
                        'line': 0,
                        'column': 0
                    }
                ]
            };
            return knowledgeData;
        }

        if (!('url' in analyzedData['page'])) {
            return knowledgeData;
        }

        if (url === this.groups[group]['page-not-found-url']) {
            const page_url = analyzedData['page']['url'];
            this.groups[group]['page-not-found-url'] = page_url
            const content = analyzedData['page']['content'];
            knowledgeData['is-page-not-found-page'] = true;

            if (content !== '') {
                const dom = new JSDOM(content);
                const doc = dom.window.document;
                const title = doc.querySelector('title');
                if (title) {
                    knowledgeData['page-title'] = title.textContent
                        .replace(/\n/g, ' ')
                        .replace(/\t/g, ' ')
                        .replace(/ {2,}/g, ' ').trim();
                }

                const header1 = doc.querySelector('h1');
                if (header1) {
                    knowledgeData['h1'] = header1.textContent
                        .replace(/\n/g, ' ')
                        .replace(/\t/g, ' ')
                        .replace(/ {2,}/g, ' ').trim();
                }

                const html = doc.querySelector('html');
                if (html && html.hasAttribute('lang')) {
                    knowledgeData['lang'] = this.getLocaleCode(html.getAttribute('lang'));
                }

                let body = doc.querySelector('main');
                if (!body) {
                    body = doc.querySelector('body');
                }
                if (body) {
                    // Specify the tags you want to remove
                    const tagsToRemove = ['script', 'nav', 'header', 'footer', 'form', 'input', 'button', 'a'];
                    // Iterate through each tag and remove all instances of it
                    tagsToRemove.forEach(tag => {
                        const elements = body.querySelectorAll(tag);
                        elements.forEach(element => element.remove());
                    });

                    // Get mimized text content
                    const bodyText = body.textContent
                        .replace(/\n/g, ' ')
                        .replace(/\t/g, ' ')
                        .replace(/ {2,}/g, ' ').trim();
                    knowledgeData['body-text'] = bodyText;
                }
            }
        }

        knowledgeData['other-404-responses'].push(...analyzedData['404s']);
        // Remove duplicates using Set and filter out the specific value
        knowledgeData['other-404-responses'] = [...new Set(knowledgeData['other-404-responses'])]

        const status = analyzedData['page']['status'];
        knowledgeData['status-code'] = status

        this.addIssuesFromKnowledgeData(knowledgeData);

        return knowledgeData;
    }

    async analyzeData(url, harData, group) {
        if (this.groups[group] === undefined) {
            this.groups[group] = {};
        }

        const analyzedData = this.transform2SimplifiedData(url, harData);
        if (!('analyzedData' in this.groups[group])) {
            this.groups[group]['analyzedData'] = []
        }
        this.groups[group]['analyzedData'].push(analyzedData);

        const knowledgeData = await this.createKnowledgeFromData(analyzedData, url, group);
        if (!('knowledgeData' in this.groups[group])) {
            this.groups[group]['knowledgeData'] = []
        }
        this.groups[group]['knowledgeData'].push(knowledgeData);

        return {
            'version': this.version,
            'dependencies': this.dependencies,
            'url': url,
            'analyzedData': analyzedData,
            'knowledgeData': knowledgeData
        };
    }

    getSummary() {
        return this;
    }
}