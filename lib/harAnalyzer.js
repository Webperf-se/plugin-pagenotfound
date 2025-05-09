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
        const packagePath = path.resolve(libFolder, 'package.json');
        this.package = JSON.parse(readFileSync(packagePath, 'utf8'));
        this.dependencies = this.package.dependencies;
        this.version = this.package.version;
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

    transform2SimplifiedData(harData) {
        const data = {
            'page': undefined,
            '404s': []
        };

        if ('log' in harData) {
            harData = harData['log'];
        }

        let reqIndex = 1;
        let hasPage = false;

        for (const entry of harData.entries) {
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


        // Read and parse the configuration file
        const libFolder = fileURLToPath(new URL('..', import.meta.url));
        const localeFilePath = path.resolve(libFolder, 'locale', `${knowledgeData['lang']}.json`);

        if (!fs.existsSync(localeFilePath)) {
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
                }]
            };
        } else {
            const localeData = JSON.parse(readFileSync(localeFilePath, 'utf8'));
            const validNotFoundTexts = localeData['valid-not-found-texts'];
            const bodyText = knowledgeData['body-text'] || '';
            const containsValidText = validNotFoundTexts.some(text => bodyText.includes(text));
            if (!containsValidText) {
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
            'lang': 'sv',
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
                'no-network': {
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
                }
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
                    const lang_code = html.getAttribute('lang');
                    if (lang_code.includes('en')) {
                        knowledgeData['lang'] = 'en';
                    } else {
                        knowledgeData['lang'] = 'sv';
                    }
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

        const analyzedData = this.transform2SimplifiedData(harData);
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