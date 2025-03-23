import { JSDOM } from 'jsdom';

export class HarAnalyzer {
    constructor() {
        this.groups = {};
    }
    getAnalyzableUrl(url, uuid, group) {
        if (this.groups[group] !== undefined) {
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
            url: test_url
        }
        return test_url;
    }

    transform2SimplifiedData(harData) {
        const data = {
            htmls: []
        };

        if ('log' in harData) {
            harData = harData['log'];
        }

        let reqIndex = 1;

        for (const entry of harData.entries) {
            const req = entry.request;
            const res = entry.response;
            const reqUrl = req.url;

            if (!res.content || !res.content.mimeType || !res.content.size || res.content.size <= 0 || !res.status) {
                continue;
            }

            if (res.content.mimeType.includes('html')) {
                data.htmls.push({
                    url: reqUrl,
                    content: res.content.text,
                    status: res.status,
                    index: reqIndex
                });
            }

            reqIndex++;
        }
        return data;
    }

    createKnowledgeFromData(analyzedData) {
        const knowledgeData = {
            'lang': undefined,
            'page-title': undefined,
            'h1': undefined,
            'body-text': undefined,
            'status-code': undefined
        };
        if (analyzedData === undefined) {
            return knowledgeData;
        }

        if (!('htmls' in analyzedData)) {
            return knowledgeData;
        }

        if (analyzedData['htmls'].length === 0) {
            return knowledgeData;
        }

        const content = analyzedData['htmls'][0]['content'];

        if (content !== '') {
            const dom = new JSDOM(content);
            const doc = dom.window.document;
            const title = doc.querySelector('title');
            if (title) {
                knowledgeData['page-title'] = title.textContent;
            }

            const header1 = doc.querySelector('h1');
            if (header1) {
                knowledgeData['h1'] = header1.textContent;
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

            const body = doc.querySelector('body');
            if (body) {
                // Remove each <script> tag
                const scripts = body.querySelectorAll('script');
                scripts.forEach(script => script.remove());
                // Get mimized text content
                const bodyText = body.textContent
                    .replace(/\n/g, ' ')
                    .replace(/\t/g, ' ')
                    .replace(/ {2,}/g, ' ').trim();
                knowledgeData['body-text'] = bodyText;
            }
        }

        const status = analyzedData['htmls'][0]['status'];
        knowledgeData['status-code'] = status

        return knowledgeData;
    }

    analyzeData(url, harData, group) {
        if (this.groups[group] === undefined) {
            return {};
        }

        if ('analyzedData' in this.groups[group]) {
            return this.groups[group];
        }

        if (url !== this.groups[group]['url']) {
            return this.groups[group];
        }

        const analyzedData = this.transform2SimplifiedData(harData);
        this.groups[group]['analyzedData'] = analyzedData;

        const knowledgeData = this.createKnowledgeFromData(analyzedData);
        this.groups[group]['knowledgeData'] = knowledgeData;

        return this.groups[group];
    }

    getSummary() {
        return this;
    }
}