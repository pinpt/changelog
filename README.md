[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]
[![LinkedIn][linkedin-shield]][linkedin-url]

<!-- PROJECT LOGO -->
<br />
<p align="center">
  <a href="https://github.com/pinpt/changelog">
    <img src=".github/logo.png" alt="Changelog Logo" width="370" height="100">
  </a>

  <h3 align="center">Changelog Generator</h3>

  <p align="center">
    The project is the generator for Changelogs built using https://changelog.so and is also the project for developing new themes or otherwise customizing your own Changelog.
    <br />
    <a href="https://github.com/pinpt/changelog"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://changelog.so">View Demo</a>
    ·
    <a href="https://github.com/pinpt/changelog/issues">Report Bug</a>
    ·
    <a href="https://github.com/pinpt/changelog/issues">Request Feature</a>
  </p>
</p>

<!-- TABLE OF CONTENTS -->
<details open="open">
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->

## About The Project

Changelog.so is an app built for fast moving product teams to help them manage the way they communicate with their end users. This tool is used by changelog.so to generate static sites published by changelog.so as well as for development on new themes for yor own changelogs.

[![Product Name Screen Shot][product-screenshot]](https://changelog.so)

### Built With

- [NodeJS](https://nodejs.org)
- [Handlebars](https://handlebarsjs.com)
- [Tailwind CSS](https://tailwindcss.com/)

<!-- GETTING STARTED -->

## Getting Started

To get up and running follow these simple steps.

### Prerequisites

You'll need to install a minimum of NodeJS v14 or later to use this project.

You can either install it globally or use npx:

```sh
npm install @pinpt/changelog -g
```

You can also use npx:

```sh
npx @pinpt/changelog
```

You can run the program without arguments or use the `--help` flag to get more details for each command.

For example, to get general help:

```sh
changelog --help
```

To get a command specific help:

```sh
changelog create --help
```

> NOTE: you do not need to fork this repo directly unless you want to make a change to the basic template or the CLI tool itself.

## Create a new theme

To develop a new theme, you need to first generate a template project.

1. Create a theme
   ```sh
   npx @pinpt/changelog create --site SLUG --name THEME
   ```
   Replace SLUG with either your site slug or the hostname. Replace THEME with the name of your theme. The THEME is optional and if not provided defaults to the same name as your site. For more options, use `--help`.
2. Change into the theme directory
3. Install NPM packages
   ```sh
   npm install
   ```
   This is optional. If you have installed the changelog npm globally, it will pick up that too.

## Building your theme

Once you have installed a theme or cloned a repo with an existing theme, you will want to build your theme. Building your theme converts your theme template files into their equivalent generated posts for each of your changelogs.

```sh
npm run build
```

By default, this will generate your theme into `$PWD/dist`. You can get further options by using the `--help` option.

## Developing your theme

To develop a theme, you want to make changes to your `theme.css` or override one of the template partial files (named with `.hbs` extension). The templates are built in HTML and use Handlebars for templating. You can override a specific partial by creating a new file named using the pattern `[SCOPE]_[NAME].hbs` such as `web_footer.hbs` which will override the base footer for the web scope. We currently have two scopes (web and email). The email scope is for modifying the email. You can create a new email template by creating a file named `email.html` in your theme. However, we highly recommend you instead create an partial override instead as the base email template has been tested to work in a majority of the email clients in the market.

To run the dev server:

```sh
npm run dev
```

This will start a local dev server on port 4444 running your generated site. On startup, it will build your entire site and watch for changes to your theme directory and rebuild as you make changes.

### Packaging your theme

Once you're ready to deploy your theme, you'll need to package your theme and then upload it to the `Theme` area in Settings.

To package:

```sh
npm run package
```

This will create a `theme.zip` file in your `$PWD/dist` folder by default.

> WARNING: make sure you check-in your changes to GitHub or otherwise back them up. If you delete or update the theme in the app, we might be able recover your files or changes but you will need to contact us to provide assistance since this is a manual process.

### Handlebars

We support the following additional helper functions in handlebars:

- `formatNumber` - format a number
- `compactInteger` - return a compact representation of an integer (such as 5K)
- `boundedNumber` - return a bounded number value
- `fileSize` - return a human representation of a file size (such as 5KB)
- `truncate` - truncate a string to a max length
- `truncateWords` - truncate a set of words to a max count
- `capitalize` - capitalize a string
- `titleCase` - title case a string
- `pathname` - return the pathname part of string that is a URL
- `gt` - a `>` block expression
- `lt` - a `<` block expression
- `gte` - a `>=` block expression
- `lte` - a `<=` block expression
- `first` - return the first item in an array
- `last` - return the last item in an array
- `empty` - returns true if the array is empty
- `after` - returns one or more items from an array (similar to splice)
- `pick` - pull out an item from an array at a specific index
- `include` - include another file
- `fontawesome-icon` - generate a fontawesome icon (only available on web scope)
- `friendly-date` - generate a friendly date
- `iso_date` - generate an ISO date from a number
- `cover_image_url` - return the url to the cover image or empty string if not provided
- `author` - return a formatted list of authors
- `twitter_handle` - return the twitter handle from a twitter url

### Configuration

You can disable certain features from the base template by modifying the `changelog.features` fields in `package.json`. The following are the current flags:

- `themeSwitcher`: if you want to enable dark/light mode theme switching
- `search`: if you want to enable site search
- `tags`: if you want to enable displaying tags on a post
- `tagFilter`: if you want to enable filtering by tags
- `authors`: if you want to enable showing the author(s) on the post
- `claps`: if you want to display the clap count for a post
- `pageviews`: if you want to display the page view count for a post
- `highfive`: if you want to enable "highfive" (which results in claps) for posts
- `social`: if you want enable the social buttons in the footer (must be configured in `Settings/Theme` in the app)

### Versioning

You can control the version of your site and tie it to a specific version by changing the `changelog.version` field in `package.json`. This must be either `latest` or a valid [semantic version](https://semver.org) rule. If you use `latest`, we will build your site with the latest verion of the builder (this repo) as they are published. If you set the value to `^2.0.0`, for example, it will only support the 2.x version of the builder. We strongly recommend using `latest` unless you have made significant changes to your project which could be broken as we upgrade the base theme.

<!-- ROADMAP -->

## Roadmap

See the [open issues](https://github.com/pinpt/changelog/issues) for a list of proposed features (and known issues).

<!-- CONTRIBUTING -->

## Contributing

Contributions are what make the open source community such an amazing place to be learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<!-- LICENSE -->

## License

Copyright &copy; 2021 by Pinpoint Software, Inc. Distributed under the MIT License. See `LICENSE` for more information.

<!-- CONTACT -->

## Contact

If you need any assistance at all, please contact support@changelog.so. You can also contact us up in the Changelog app using the chat bubble.

Jeff Haynie - [@jhaynie](https://twitter.com/jhaynie) - jeff@pinpoint.com

Project Link: [https://github.com/pinpt/changelog](https://github.com/pinpt/changelog)

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[issues-shield]: https://img.shields.io/github/issues/pinpt/changelog.svg?style=for-the-badge
[issues-url]: https://github.com/pinpt/changelog/issues
[license-shield]: https://img.shields.io/github/license/pinpt/changelog.svg?style=for-the-badge
[license-url]: https://github.com/pinpt/changelog/blob/master/LICENSE
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://www.linkedin.com/company/pinpoint-software
[product-screenshot]: .github/product-screenshot.png
