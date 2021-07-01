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
      default: "api.changelog.so",
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
  },
  run: async (_args, flags) => {
    ensureDir(flags.theme);
    ensureDir(flags.output);
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

    const onlyEmail = flags.email && !flags.index;
    const distDir = flags.output;

    const baseSrcDir = path.join(__dirname, "..");
    const webSrcDir = path.join(baseSrcDir, "web");
    const emailSrcDir = path.join(baseSrcDir, "email");
    const baseThemeDir = path.join(baseSrcDir, "theme", "base");
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

    await generate(changelogs, site, flags, {
      emailTemplate,
      indexTemplate,
      pageTemplate,
      searchTemplate,
      emailDistDir,
    });

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

const processIndex = (site, changelogs, flags, indexTemplate) => {
  return new Promise((resolve, reject) => {
    const buf = indexTemplate({
      site,
      changelogs,
      url: site.url,
    });
    const fn = path.join(flags.output, "index.html");
    minifyAndWriteHTML(fn, buf, flags.quiet).then(resolve).catch(reject);
  });
};

const processSearch = (site, flags, searchTemplate) => {
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
    });
    const fn = path.join(flags.output, "search.html");
    minifyAndWriteHTML(fn, buf, flags.quiet).then(resolve).catch(reject);
  });
};

const processPage = (site, changelog, flags, pageTemplate) => {
  if (!pageTemplate) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const buf = pageTemplate({
      site,
      changelog,
      url: changelog.url,
    });
    const basefn = path.join(flags.output, "entry", changelog.id + ".html");
    const dir = path.dirname(basefn);
    ensureDir(dir);
    const fn = path.join(basefn);
    minifyAndWriteHTML(fn, buf, flags.quiet).then(resolve).catch(reject);
  });
};

const processEmail = (
  site,
  changelog,
  changelogs,
  outfn,
  flags,
  emailTemplate,
  emailDistDir
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
        poweredByImage: "https://cdn.changelog.so/images/misc/poweredBy.png",
        poweredByLink: "__POWEREDBY_LINK__",
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

const generate = async (changelogs, site, flags, templates) => {
  if (flags.index) {
    await Promise.all([
      processIndex(site, changelogs, flags, templates.indexTemplate), // run index before the others so we get all the styles,
      processSearch(site, flags, templates.searchTemplate),
    ]);
  }
  return await changelogs.map(async (changelog) => {
    debugLog(
      flags.debug,
      `processing changelog ${changelog.id} ${changelog.title}`
    );
    return await Promise.all([
      await processPage(site, changelog, flags, templates.pageTemplate),
      flags.email
        ? await processEmail(
            site,
            changelog,
            changelogs,
            "",
            flags,
            templates.emailTemplate,
            templates.emailDistDir
          )
        : Promise.resolve(),
    ]);
  });
};