import fs from "node:fs";
import path from "node:path";
import Handlebars from "handlebars";
import {
  minifyHTML,
  writeJSON,
  apiRequest,
  ensureExists,
  ensureDir,
  verbose,
  debugLog,
  error,
  getBuilderVersion,
  __dirname,
} from "./util.mjs";
import { registerHelpers } from "./handlebars.mjs";

const createTemplate = (srcDirs, name) => {
  const fn = srcDirs
    .map((dir) => path.join(dir, name))
    .find((fn) => fs.existsSync(fn));
  if (!fs.existsSync(fn)) {
    error(
      `Couldn't find template ${name} in any of the following directories: ${srcDirs.join(
        ", "
      )}`
    );
  }
  const buf = fs.readFileSync(fn);
  return Handlebars.compile(buf.toString());
};

export default {
  description: "Build your theme",
  flags: {
    site: {
      description: "The site to build which can be the slug or the hostname",
      type: "string",
      isRequired: (flags) => !flags.file,
    },
    theme: {
      description: "The path to the theme directory",
      type: "string",
      default: path.join(__dirname, "../theme/default"),
      isRequired: false,
      alias: "t",
    },
    output: {
      description: "The path to the output directory",
      type: "string",
      default: path.join(process.cwd(), "dist"),
      isRequired: false,
      alias: "o",
    },
    host: {
      description: "Override the API hostname",
      type: "string",
      default: "api.pinpoint.com",
      isRequired: false,
      alias: "h",
    },
    file: {
      description: "The data input JSON file to use instead of the API",
      type: "string",
      isRequired: false,
      alias: "f",
    },
    debug: {
      description: "Turn on extra logging",
      type: "boolean",
      default: false,
      isRequired: false,
    },
    quiet: {
      description: "Suppress all output except errors",
      type: "boolean",
      default: false,
      isRequired: false,
    },
    index: {
      description: "Include processing the index.html file",
      type: "boolean",
      default: true,
      isRequired: false,
    },
    email: {
      description: "Include processing the email.html file",
      type: "boolean",
      default: true,
      isRequired: false,
    },
    emailOnly: {
      description: "Only process the email.html file",
      type: "boolean",
      default: false,
      isRequired: false,
      hidden: true,
    },
  },
  run: async (_args, flags) => {
    ensureDir(flags.theme);
    ensureDir(flags.output);
    debugLog(flags.debug, "Using theme: " + flags.theme);
    debugLog(flags.debug, "Using output: " + flags.output);
    const builderVersion = getBuilderVersion();
    let config = { builderVersion };
    const pkgFn = path.join(flags.theme, "package.json");
    if (fs.existsSync(pkgFn)) {
      const pkgJSON = JSON.parse(
        ensureExists(path.join(flags.theme, "package.json"), true)
      );
      const { changelog, ...rest } = pkgJSON;
      config = { ...config, ...changelog, package: rest };
    } else {
      // get the default features if we're building using the default theme
      // or an older legacy theme with no package.json
      const templatePackage = path.join(__dirname, "../template/package.json");
      const pkgJSON = JSON.parse(ensureExists(templatePackage, true));
      const { changelog, ...rest } = pkgJSON;
      config = { ...config, ...changelog, package: rest };
    }
    debugLog(flags.debug, "Using config: " + JSON.stringify(config));
    let data;
    if (flags.file) {
      data = JSON.parse(ensureExists(flags.file, true));
    } else {
      const field = flags.site.includes(".") ? "hostname.value" : "slug";
      data = await apiRequest(
        flags.host,
        `/changelog/list/${flags.site}/${field}?html=true&stats=true`
      );
      writeJSON(path.join(flags.output, "data.json"), data);
    }
    const { site, changelogs } = data;
    site.url = `https://${
      site.hostname && site.hostname.value
        ? site.hostname.value
        : `${site.slug}.changelog.so`
    }`;

    const onlyEmail = flags.emailOnly;
    const distDir = flags.output;

    const baseSrcDir = path.join(__dirname, "..");
    const webSrcDir = path.join(baseSrcDir, "web");
    const emailSrcDir = path.join(baseSrcDir, "email");
    const baseThemeDir = path.join(baseSrcDir, "theme", "default");
    const srcDir = path.resolve(flags.theme || baseThemeDir);
    const staticDistDir = path.join(distDir, "static");
    const emailDistDir = path.join(distDir, "email");

    ensureDir(staticDistDir);
    ensureDir(emailDistDir);

    const shutdown = registerHelpers({
      baseSrcDir,
      webSrcDir,
      emailSrcDir,
      srcDir,
      distDir,
      host: flags.host,
      staticDistDir,
      flags,
      config,
    });

    const indexTemplate = onlyEmail
      ? undefined
      : createTemplate([srcDir, webSrcDir, baseThemeDir], "index.html");

    const pageTemplate = onlyEmail
      ? undefined
      : createTemplate([srcDir, webSrcDir, baseThemeDir], "page.html");

    const emailTemplate = createTemplate(
      [srcDir, emailSrcDir, baseThemeDir],
      "email.html"
    );

    const searchTemplate = onlyEmail
      ? undefined
      : createTemplate([srcDir, webSrcDir, baseThemeDir], "search.html");

    await generate(
      changelogs,
      site,
      flags,
      {
        emailTemplate,
        indexTemplate,
        pageTemplate,
        searchTemplate,
        emailDistDir,
        staticDistDir,
        distDir,
      },
      config
    );

    shutdown();
  },
};

const minifyAndWriteHTML = (fn, buf, quiet) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(fn, buf, (err) => {
      if (err) {
        return reject(err);
      }
      minifyHTML(fn)
        .then((out) => {
          fs.writeFile(fn, out, (err) => {
            if (err) {
              return reject(err);
            }
            verbose(quiet, `Generated ${fn}`);
            resolve();
          });
        })
        .catch(reject);
    });
  });
};

const processIndex = (
  site,
  changelogs,
  flags,
  indexTemplate,
  page,
  pages,
  config
) => {
  debugLog(
    flags.debug,
    `Generating index page ${page} of ${pages} with ${changelogs.length} changelogs`
  );

  const previousUrl =
    page === 2 ? "/" : page > 2 ? `/entries?page=${page - 1}` : undefined;
  const nextUrl = page < pages ? `/entries?page=${page + 1}` : undefined;

  return new Promise((resolve, reject) => {
    const buf = indexTemplate({
      site,
      changelogs,
      url: site.url,
      page,
      pages,
      previousUrl,
      nextUrl,
      config,
    });
    const fn = path.join(
      flags.output,
      `index${page > 1 ? `_${page}` : ""}.html`
    );
    minifyAndWriteHTML(fn, buf, flags.quiet).then(resolve).catch(reject);
  });
};

const processSearch = (site, flags, searchTemplate, config) => {
  return new Promise((resolve, reject) => {
    const buf = searchTemplate({
      site,
      changelogs: [
        {
          id: "__PLACEHOLDER_ID__",
          title: "__PLACEHOLDER_TITLE__",
          headline: "__PLACEHOLDER_HEADLINE__",
          dateAt: Date.now(),
          site_id: site.id,
          cover_image: "https://changelog.so",
        },
      ],
      search: true,
      url: site.url,
      config,
    });
    const fn = path.join(flags.output, "search.html");
    minifyAndWriteHTML(fn, buf, flags.quiet).then(resolve).catch(reject);
  });
};

const processPage = (
  site,
  changelog,
  nextChangelog,
  previousChangelog,
  flags,
  pageTemplate,
  config
) => {
  if (!pageTemplate) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const buf = pageTemplate({
      site,
      changelog,
      url: changelog.url,
      nextUrl: nextChangelog?.url,
      nextTitle: nextChangelog?.title,
      previousUrl: previousChangelog?.url,
      previousTitle: previousChangelog?.title,
      config,
    });
    const basefn = path.join(flags.output, "entry", changelog.id + ".html");
    const dir = path.dirname(basefn);
    ensureDir(dir);
    const fn = path.join(basefn);
    minifyAndWriteHTML(fn, buf, flags.quiet).then(resolve).catch(reject);
  });
};

const processAssets = (flags, staticDistDir) => {
  fs.readdirSync(flags.theme)
    .filter((fn) => /\.(gif|png|jpg|jpeg|webp|mov|mp3|mp4|webm|svg)$/.test(fn))
    .map((fn) => {
      const f = path.join(flags.theme, fn);
      const outfn = path.join(staticDistDir, path.basename(fn));
      fs.copyFileSync(f, outfn);
      verbose(flags.quiet, `Copied asset ${path.basename(fn)} to ${outfn}`);
    });
};

const processEmail = (
  site,
  changelog,
  changelogs,
  outfn,
  flags,
  emailTemplate,
  emailDistDir,
  config
) => {
  return new Promise((resolve, reject) => {
    try {
      const buf = emailTemplate({
        site,
        changelog,
        changelogs,
        url: changelog.url,
        manageSubscriptionLink: "__MANAGE_SUBSCRIPTION_LINK__",
        unsubscribeLink: "__UNSUBSCRIBE_LINK__",
        poweredByImage: "https://cdn.pinpoint.com/images/email/powered_by_30.png",
        poweredByLink: "__POWEREDBY_LINK__",
        config,
      });
      const basefn = outfn || path.join(emailDistDir, changelog.id + ".html");
      const dir = path.dirname(basefn);
      ensureDir(dir);
      const fn = path.join(basefn);
      fs.writeFileSync(fn, buf);
      verbose(flags.quiet, `Generated ${fn}`);
      resolve();
    } catch (ex) {
      reject(ex);
    }
  });
};

const generate = async (changelogs, site, flags, templates, config) => {
  if (flags.emailOnly) {
    await processEmail(
      site,
      changelogs[0],
      changelogs,
      path.join(templates.distDir, "email.html"),
      flags,
      templates.emailTemplate,
      templates.emailDistDir,
      config
    );
    return;
  }
  if (flags.index) {
    const FIRST_PAGE_SIZE = 11;
    const PAGE_SIZE = 10;
    const pages =
      changelogs.length > FIRST_PAGE_SIZE
        ? Math.ceil((changelogs.length - FIRST_PAGE_SIZE) / PAGE_SIZE) + 1
        : 1;

    debugLog(
      flags.debug,
      `${changelogs.length} changelogs found, generating ${pages} index pages`
    );

    await Promise.all([
      processIndex(
        site,
        changelogs.slice(0, Math.min(changelogs.length, FIRST_PAGE_SIZE)),
        flags,
        templates.indexTemplate,
        1,
        pages,
        config
      ), // run index before the others so we get all the styles,
      processSearch(site, flags, templates.searchTemplate, config),
      processAssets(flags, templates.staticDistDir),
    ]);

    if (pages > 1) {
      const remainingChangelogs = changelogs.slice(FIRST_PAGE_SIZE);
      let page = 2;
      for (let i = 0; i < remainingChangelogs.length; i += PAGE_SIZE) {
        processIndex(
          site,
          remainingChangelogs.slice(i, i + PAGE_SIZE),
          flags,
          templates.indexTemplate,
          page,
          pages,
          config
        );
        page += 1;
      }
    }
  }

  return await changelogs.map(async (changelog, index) => {
    debugLog(
      flags.debug,
      `processing changelog ${changelog.id} ${changelog.title}`
    );
    return await Promise.all([
      await processPage(
        site,
        changelog,
        index < changelogs.length - 1 ? changelogs[index + 1] : undefined, // next changelog
        index > 0 ? changelogs[index - 1] : undefined, // previous changelog
        flags,
        templates.pageTemplate,
        config
      ),
      flags.email
        ? await processEmail(
            site,
            changelog,
            changelogs,
            "",
            flags,
            templates.emailTemplate,
            templates.emailDistDir,
            config
          )
        : Promise.resolve(),
    ]);
  });
};
