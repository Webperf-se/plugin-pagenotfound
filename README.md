# plugin-pagenotfound

Page not found plugin for sitespeed.io

## Overview

The `plugin-pagenotfound` is a plugin for [sitespeed.io](https://www.sitespeed.io/) that helps identify and log "Page Not Found" (404) errors during web performance testing. It integrates with sitespeed.io to provide detailed information about 404 errors, including status codes, response titles, headers, and language text.

## Features

- Logs status codes of requested webpages.
- Handles redirects and logs the final status code.
- Rates the response based on status code, title, header, and language text.
- Checks the page's text against phrases a "page not found" page is expected to contain, in the language of the page's `lang` attribute. Phrase lists live in `locale/<lang>.json`; supported today: Danish, English, Finnish, French, German, Icelandic, Italian, Norwegian (bokmål and nynorsk, `nb` and `nn` map to `no`), Spanish and Swedish. A page in another language gets `no-unsupported-locale-use` and is checked against every list. A page without `lang` is checked against every list. To add a language, add a `locale/<code>.json` with a `valid-not-found-texts` array of lowercase phrases and a case in `test/unit/`.
- Integrates seamlessly with sitespeed.io.

## Installation

To install the plugin, run the following command:

```sh
npm install plugin-pagenotfound
```

## Usage

To use the plugin with sitespeed.io, add it to your sitespeed.io configuration file or command line options.

### Configuration

Add the plugin to your sitespeed.io configuration file:

```json
{
  "plugins": {
    "plugin-pagenotfound": {
      "enabled": true
    }
  }
}
```

### Command Line

You can also enable the plugin via the command line:

```sh
sitespeed.io --plugins.add plugin-pagenotfound
```

## Example

Here is an example of how to use the plugin with sitespeed.io:

```sh
sitespeed.io https://www.example.com --plugins.add plugin-pagenotfound
```

## Development

### Running Tests

To run the tests, use the following command:

```sh
npm test
```

### Linting

To lint the code, use the following command:

```sh
npm run lint
```

To automatically fix linting issues, use the following command:

```sh
npm run lint:fix
```

### License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on GitHub.

## Author

- **7h3Rabbit** - [GitHub](https://github.com/7h3Rabbit)

## Acknowledgements

- [sitespeed.io](https://www.sitespeed.io/)
- [webperf-sitespeedio-plugin](https://www.npmjs.com/package/webperf-sitespeedio-plugin)
