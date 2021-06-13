[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]
[![LinkedIn][linkedin-shield]][linkedin-url]

<!-- PROJECT LOGO -->
<br />
<p align="center">
  <a href="https://github.com/pinpt/changelog-generator">
    <img src=".github/logo.png" alt="Changelog Logo" width="370" height="100">
  </a>

  <h3 align="center">Changelog Generator</h3>

  <p align="center">
    The project is the generator for Changelogs built using https://changelog.so and is also the project for developing new themes or otherwise customizing your own Changelog.
    <br />
    <a href="https://github.com/pinpt/changelog-generator"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://changelog.so">View Demo</a>
    ·
    <a href="https://github.com/pinpt/changelog-generator/issues">Report Bug</a>
    ·
    <a href="https://github.com/pinpt/changelog-generator/issues">Request Feature</a>
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

To get a local copy up and running follow these simple steps.

### Prerequisites

You'll need to install a minimum of NodeJS v14 or later to use this project.

If you just want to generate your site, you can install globally:

- npm
  ```sh
  npm install @pinpt/changelog-generator -g
  ```

To develop a new theme, you need to install the repository.

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/pinpt/changelog-generator.git
   ```
2. Install NPM packages
   ```sh
   npm install
   ```

<!-- USAGE EXAMPLES -->

## Usage

If you're using the npm global version, you can replace `npm run` below with `changelog-gen`.

To generate your site statically, you can run the following command:

```sh
npm run -- [slug]
```

Replace `[slug]` with your slug or custom hostname specified in settings.

This will generate your static site into `$PWD/dist` by default. You can change to location by specifying `--output`.

For help with various options for generating output, run:

```sh
npm run help
```

### Building a new theme

If you're using the npm global version, you can replace `npm run` below with `changelog-theme`.

If you'd like to customize the look-and-feel of your generated site, you can develop a new theme. First, copy the default theme under the directory `src/theme/default` and create a new folder such as `src/theme/mytheme`. Take care to only modify the files in the theme directory as we only accept HTML and CSS files when uploading your theme.

Now, run with your specific theme:

```sh
npm run -- [slug] [theme]
```

Such as if you're theme name was `mytheme`

```sh
npm run -- [slug] mytheme
```

If you're using the npm global version, use the following instead:

```sh
changelog-gen [slug] --theme-dir /path/to/my/theme
```

Replace `/path/to/my/theme` with the path to your theme directory. In this case, you don't need to specify the name of the theme as an argument.

When you're ready to use your theme in production, just run the following command to create your theme file:

```sh
npm run build-theme -- [theme]
```

Replace `[mytheme]` with the name of your theme.

If you're using the npm global version, use:

```sh
changelog-theme [theme]
```

This will generate a file such as `[theme].zip` into `$PWD/dist` by default. You can change to location by specifying `--output`.

You'll use this file in the Changelog Setting Theme section to upload your theme.

### Developing with watch

To develop a theme you'll likely want to use the watch functionality to re-generate your site each time you make changes to your theme.

```sh
npm run -- [slug] --watch
```

<!-- ROADMAP -->

## Roadmap

See the [open issues](https://github.com/pinpt/changelog-generator/issues) for a list of proposed features (and known issues).

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

Jeff Haynie - [@jhaynie](https://twitter.com/jhaynie) - jeff@pinpoint.com

Project Link: [https://github.com/pinpt/changelog-generator](https://github.com/pinpt/changelog-generator)

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[issues-shield]: https://img.shields.io/github/issues/pinpt/changelog-generator.svg?style=for-the-badge
[issues-url]: https://github.com/pinpt/changelog-generator/issues
[license-shield]: https://img.shields.io/github/license/pinpt/changelog-generator.svg?style=for-the-badge
[license-url]: https://github.com/pinpt/changelog-generator/blob/master/LICENSE
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://www.linkedin.com/company/pinpoint-software
[product-screenshot]: .github/product-screenshot.png
