import { getLogger } from '@sitespeed.io/log';
import { SitespeedioPlugin } from '@sitespeed.io/plugin';
import { URL } from 'url';

// Function to generate a GUID (mocked to return a string of length 5)
function getGuid(length) {
  return Math.random().toString(36).substring(2, length + 2);
}

function changeUrlTo404Url(url) {
  const urlObj = new URL(url);
  let path = `${getGuid(5)}/finns-det-en-sida/pa-den-har-adressen/testanrop/`;

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

// https://www.sitespeed.io/documentation/sitespeed.io/plugins/#create-your-own-plugin
// node bin\sitespeed.js -n 1 --plugins.add analysisstorer --plugins.add ../../../plugin-pagenotfound/lib/index.js --plugins.list https://webperf.se

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
    super.log('A' + JSON.stringify(message))
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
            pug: '<html><body>TEST</body></html>',
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
        const group = message.group;
        if (message.source !== pluginname) {
          const test_url = changeUrlTo404Url(url);
          queue.postMessage(this.make('url', {}, { url: test_url, group: message.group }));
        } else {
          if (!!url) {
            super.sendMessage(
              // The HTML plugin will pickup every message names *.pageSummary
              // and publish the data under pageInfo.data.*.pageSummary
              // in this case pageInfo.data.gpsi.pageSummary
              pluginname + '.pageSummary',
              1337,
              {
                url,
                group
              }
            );
          }
        }

      }
    }
  }
  close(options, errors) {
    // Cleanup if necessary
  }
}