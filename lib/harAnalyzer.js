import { JSDOM } from 'jsdom';

export class HarAnalyzer {
    constructor() {
        this.groups = {};
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

    transform2SimplifiedData(harData, group) {
        const data = {
            'page': {},
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
            }

            if (res.status === 404 && this.groups[group]['page-not-found-url'] !== reqUrl) {

                data['404s'].push(reqUrl)
            }

            reqIndex++;
        }
        return data;
    }

    createKnowledgeFromData(analyzedData, knowledgeData, url, group) {
        if (!knowledgeData) {
            knowledgeData = {
                'lang': undefined,
                'page-title': undefined,
                'h1': undefined,
                'body-text': undefined,
                'status-code': undefined,
                'other-404-responses': []
            };
        }

        if (analyzedData === undefined) {
            return knowledgeData;
        }

        if (!('page' in analyzedData)) {
            return knowledgeData;
        }

        if (!('url' in analyzedData['page'])) {
            return knowledgeData;
        }

        knowledgeData['other-404-responses'].push(...analyzedData['404s']);
        // Remove duplicates using Set and filter out the specific value
        knowledgeData['other-404-responses'] = [...new Set(knowledgeData['other-404-responses'])]

        if (url === this.groups[group]['page-not-found-url']) {
            const content = analyzedData['page']['content'];

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
                    const tagsToRemove = ['script', 'nav', 'header', 'footer', 'form', 'a'];
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

        const status = analyzedData['page']['status'];
        knowledgeData['status-code'] = status

        return knowledgeData;
    }

    analyzeData(url, harData, group) {
        if (this.groups[group] === undefined) {
            return {};
        }

        const analyzedData = this.transform2SimplifiedData(harData, group);
        if (!('analyzedData' in this.groups[group])) {
            this.groups[group]['analyzedData'] = []
        }
        this.groups[group]['analyzedData'].push(analyzedData);

        const knowledgeData = this.createKnowledgeFromData(analyzedData, this.groups[group]['knowledgeData'], url, group);
        this.groups[group]['knowledgeData'] = knowledgeData;

        return this.groups[group];
    }

    getSummary() {
        return this;
    }
}