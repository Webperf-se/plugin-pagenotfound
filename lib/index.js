import { SitespeedioPlugin } from '@sitespeed.io/plugin';
import { HarAnalyzer } from './harAnalyzer.js';

// https://www.sitespeed.io/documentation/sitespeed.io/plugins/#create-your-own-plugin
// node bin\sitespeed.js -n 1 --plugins.add analysisstorer --plugins.add ../../../plugin-pagenotfound/lib/index.js --browsertime.chrome.includeResponseBodies all https://webperf.se

const pluginname = 'webperf-plugin-pagenotfound'

export default class PageNotFoundPlugin extends SitespeedioPlugin {
  constructor(options, context, queue) {
    super({ name: pluginname, options, context, queue });
  }

  open(context, options) {
    this.make = context.messageMaker(pluginname).make;
    this.harAnalyzer = new HarAnalyzer();
  }

  processMessage(message, queue) {
    // const filterRegistry = this.filterRegistry;
    switch (message.type) {
      case 'sitespeedio.setup': {
        // Let other plugins know that the pagenotfound plugin is alive
        super.sendMessage('browsertime.setup');
        break;
      }
      case 'url': {
        const url = message.url;
        const uuid = message.uuid;
        const group = message.group;
        if (message.source !== pluginname) {
          const test_url = this.harAnalyzer.getAnalyzableUrl(url, uuid, group);
          if (!!test_url) {
            queue.postMessage(this.make('url', {}, { url: test_url, group: message.group }));
          }
        }
        break;
      }
      case 'browsertime.har': {
        const url = message.url;
        const group = message.group;
        const harData = message.data;
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
      case 'sitespeedio.summarize': {
        const summary = this.harAnalyzer.getSummary();
        for (let group of Object.keys(summary.groups)) {
          super.sendMessage(pluginname + '.summary', summary.groups[group], {
            group
          });
        }
        break;
      }
    }
  }
  close(options, errors) {
    // Cleanup if necessary
  }
}