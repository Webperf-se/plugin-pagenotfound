import { getLogger } from '@sitespeed.io/log';
import { SitespeedioPlugin } from '@sitespeed.io/plugin';
import { URL } from 'url';

// Function to generate a GUID (mocked to return a string of length 5)
function getGuid(length) {
  return Math.random().toString(36).substring(2, length + 2);
}

function changeUrlTo404Url(url, uuid) {
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
  return urlObj.toString();
}

function identifyFiles(harData) {
  /**
   * This function takes HAR data as input and identifies different types of files in it.
   * It categorizes them into HTML files.
   *
   * Parameters:
   * harData (object): The HAR data object.
   *
   * Returns:
   * object: An object containing categorized file data.
   */
  const data = {
    htmls: []
  };

  // Ensure the HAR data has the 'log' property
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


// https://www.sitespeed.io/documentation/sitespeed.io/plugins/#create-your-own-plugin
// node bin\sitespeed.js -n 1 --plugins.add analysisstorer --plugins.add ../../../plugin-pagenotfound/lib/index.js --browsertime.chrome.includeResponseBodies all https://webperf.se

const pluginname = 'webperf-plugin-pagenotfound'
const log = getLogger(pluginname);

export default class PageNotFoundPlugin extends SitespeedioPlugin {
  constructor(options, context, queue) {
    super({ name: pluginname, options, context, queue });
  }

  open(context, options) {
    this.make = context.messageMaker(pluginname).make;
  }

  processMessage(message, queue) {
    // const filterRegistry = this.filterRegistry;

    // First catch if we are running Browsertime and/or WebPageTest
    switch (message.type) {
      case 'browsertime.setup': {
        break;
      }
      case 'browsertime.config': {
        break;
      }
      case 'sitespeedio.setup': {
        // Let other plugins know that the pagenotfound plugin is alive
        // queue.postMessage(this.make(pluginname + '.setup'));
        queue.postMessage(
          this.make('html.pug', {
            id: pluginname,
            name: 'Page Not Found',
            pug: 'TEST',
            type: 'pageSummary'
          })
        );

        super.sendMessage('budget.addMessageType', {
          type: pluginname + '.pageSummary'
        });
        break;
      }
      case 'url': {
        const url = message.url;
        const uuid = message.uuid;
        const group = message.group;
        if (message.source !== pluginname) {
          const test_url = changeUrlTo404Url(url, uuid);
          queue.postMessage(this.make('url', {}, { url: test_url, group: message.group }));
        } else {
          // if (!!url) {
          //   super.sendMessage(
          //     // The HTML plugin will pickup every message names *.pageSummary
          //     // and publish the data under pageInfo.data.*.pageSummary
          //     // in this case pageInfo.data.gpsi.pageSummary
          //     pluginname + '.pageSummary',
          //     1337,
          //     {
          //       url,
          //       group
          //     }
          //   );
          // }
        }
        break;
      }
      case 'browsertime.har': {
        const url = message.url;
        const group = message.group;
        const harData = message.data;
        // TODO: Read HAR content
        // super.log('browsertime.hartype: ' + JSON.stringify(data))
        var data = identifyFiles(harData);
        super.log('data: ' + JSON.stringify(data))
        super.sendMessage(
          // The HTML plugin will pickup every message names *.pageSummary
          // and publish the data under pageInfo.data.*.pageSummary
          // in this case pageInfo.data.gpsi.pageSummary
          pluginname + '.pageSummary',
          data,
          {
            url,
            group
          }
        );

        break;
      }
      case 'browsertime.summary': { break; }
      case 'thirdparty.pageSummary': { break; }
      case 'pagexray.summary': { break; }
      case 'domains.summary': { break; }
      case 'coach.summary': { break; }
      case 'slowestassets.summary': { break; }
      case 'largestassets.summary': { break; }
      case 'aggregateassets.summary': { break; }
      case 'sitespeedio.summarize': { break; }
      case 'sitespeedio.prepareToRender': { break; }
      case 'sitespeedio.render': { break; }
      case 'html.finished': { break; }
      default: {
        // super.log('Unhandled type: ' + JSON.stringify(message))
        break;
      }
    }
  }
  close(options, errors) {
    // Cleanup if necessary
  }
}