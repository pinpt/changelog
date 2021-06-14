#!/usr/bin/env node

const path = require("path");
const fs = require("fs");
const mimetype = require("mimetype");
const express = require("express");
const compression = require("compression");
const _exec = require("child_process").exec;
const fetch = require("node-fetch");
const Handlebars = require("handlebars");
const arg = require("arg");
const watch = require("node-watch");
const { registerHelpers, findBin, sha1 } = require("./helpers");

const error = (msg) => {
  console.error(msg);
  process.exit(1);
};

const debugLog = (msg, o) =>
  !debug
    ? null
    : console.log.apply(
        console,
        [`🚧  ${msg}`, o ? JSON.stringify(o) : undefined].filter(Boolean)
      );
const verbose = (msg) => (quiet ? null : console.log(`✅   ${msg}`));

const help = () => {
  console.error("Usage: [options] site [theme]");
  console.error();
  console.error("Options:");
  console.error();
  console.error("-h, --help         Output usage information");
  console.error("-q, --quiet        Don't log anything except errors");
  console.error("-o, --output       Output to directory instead of ./dist");
  console.error(
    "-t, --theme-dir    Use a directory where your theme exists instead of inside src"
  );
  console.error("-f, --file         Use JSON file as input instead of API");
  console.error("-h, --host         Change the API host (internal use only)");
  console.error(
    "-p, --port         Port when running in watch mode (default:4444)"
  );
  console.error(
    "-w, --watch        Watch the src directory for changes and regenerate"
  );
  console.error();
  process.exit(0);
};

const args = arg({
  "--help": Boolean,
  "--quiet": Boolean,
  "--host": String,
  "--file": String,
  "--output": String,
  "--watch": Boolean,
  "--port": Number,
  "--theme-dir": String,
  "--debug": Boolean,
  "-q": "--quiet",
  "-h": "--host",
  "-f": "--file",
  "-o": "--output",
  "-w": "--watch",
  "-p": "--port",
  "-t": "--theme-dir",
});

const site = args["_"][0];
const theme = args["_"][1] || "default";
const port = args["--port"] || 4444;
const debug = args["--debug"];

if (!site || args["--help"]) {
  if (!args["--help"]) {
    console.error("🛑 missing your site slug or hostname as an argument");
  }
  console.error();
  help();
}
const host = args["--host"] || "api.changelog.so";
const quiet = args["--quiet"];
const distDir = path.resolve(
  args["--output"] || path.join(process.cwd(), "dist")
);

const baseSrcDir = path.join(__dirname, "../src");
const srcDir = path.resolve(
  args["--theme-dir"] || path.join(baseSrcDir, "theme", theme)
);

if (!fs.existsSync(srcDir)) {
  error(`cannot find theme at ${srcDir}`);
}

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const staticDistDir = path.join(distDir, "static");
if (!fs.existsSync(staticDistDir)) {
  fs.mkdirSync(staticDistDir, { recursive: true });
}

const shutdown = registerHelpers({
  baseSrcDir,
  srcDir,
  distDir,
  host,
  staticDistDir,
});

const createTemplate = (name) => {
  const fn = path.join(srcDir, name);
  if (!fs.existsSync(fn)) {
    error(`Couldn't find template at ${fn}`);
  }
  const buf = fs.readFileSync(fn);
  return Handlebars.compile(buf.toString());
};

const htmlMinifier = findBin("html-minifier");

const exec = (fn, args) => {
  return new Promise((resolve, reject) => {
    const cmd = `${fn} ${args.join(" ")}`;
    _exec(cmd, (err, stdout, stderr) => {
      if (err) {
        return reject(err);
      }
      if (stderr.length) {
        return new reject(new Error(stderr));
      }
      resolve(stdout);
    });
  });
};

const minifyHTML = (fn) => {
  return exec(htmlMinifier, [
    "--collapse-whitespace",
    "--remove-comments",
    "--remove-optional-tags",
    "--remove-redundant-attributes",
    "--remove-script-type-attributes",
    "--remove-tag-whitespace",
    "--minify-css",
    "true",
    "--minify-js",
    "true",
    fn,
  ]);
};

const indexTemplate = createTemplate("index.html");

const minifyAndWriteHTML = (fn, buf) => {
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
            verbose(`Generated ${fn}`);
            resolve();
          });
        })
        .catch(reject);
    });
  });
};

const processIndex = (site, changelogs) => {
  const buf = indexTemplate({
    site,
    changelogs,
    url: site.url,
  });
  const fn = path.join(distDir, "index.html");
  return minifyAndWriteHTML(fn, buf);
};

const pageTemplate = createTemplate("page.html");

const processPage = (site, changelog) => {
  const buf = pageTemplate({
    site,
    changelog,
    url: changelog.url,
  });
  const basefn = path.join(distDir, "entry", changelog.id + ".html");
  const dir = path.dirname(basefn);
  !fs.existsSync(dir) && fs.mkdirSync(dir, { recursive: true });
  const fn = path.join(basefn);
  return minifyAndWriteHTML(fn, buf);
};

const field = site.includes(".") ? "hostname.value" : "slug";
const url = `https://${host}/changelog/list/${site}/${field}?html=true&stats=true`;

const generate = async (changelogs, site) => {
  await Promise.all([
    changelogs.map((changelog) => {
      debugLog(`processing changelog ${changelog.id} ${changelog.title}`);
      return processPage(site, changelog);
    }),
  ]);
  await processIndex(site, changelogs); // must come after the others
};

(async () => {
  let changelogs, site;
  if (args["--file"]) {
    const fn = args["--file"];
    if (!fs.existsSync(fn)) {
      error(`Error finding data JSON file at ${fn}`);
    }
    const buf = JSON.parse(fs.readFileSync(fn));
    changelogs = buf.changelogs;
    site = buf.site;
    debugLog(`loaded data from ${fn}`, { data: buf });
  } else {
    const resp = await fetch(url);
    const body = await resp.json();
    if (!body.success) {
      error(`Error fetching changelogs. ${body.message}`);
    }
    debugLog(`fetched from ${url}`, { body });
    changelogs = body.changelogs;
    site = body.site;
  }
  site.url = `https://${
    site.hostname && site.hostname.value
      ? site.hostname.value
      : `${site.slug}.changelog.so`
  }`;
  const ts = Date.now();
  await generate(changelogs, site, url);
  verbose(`Generated ${changelogs.length} changelogs in ${Date.now() - ts}ms`);
  shutdown();
  if (args["--watch"]) {
    console.log(`🏁  Watching for changes in ${srcDir}`);
    const app = express();
    app.use(compression());
    app.get("/", (req, resp) => {
      fn = path.join(distDir, "index.html");
      resp.set("Content-Type", "text/html");
      resp.set(
        "Cache-Control",
        "public, max-age=0, must-revalidate, stale-if-error=0"
      );
      resp.send(fs.readFileSync(fn));
    });
    app.get("/a.js", (req, resp) => resp.status(200).end());
    app.get("/entry/:id/:title?", (req, resp) => {
      fn = path.join(distDir, "entry", req.params.id + ".html");
      resp.set("Content-Type", "text/html");
      resp.set("Cache-Control", "max-age=0, no-cache");
      resp.send(fs.readFileSync(fn));
    });
    app.get("*", (req, resp) => {
      let fn = req.url;
      fn = path.join(distDir, fn);
      if (!fs.existsSync(fn)) {
        resp.status(404).end();
        return;
      }
      resp.set("Content-Type", mimetype.lookup(fn));
      const buf = fs.readFileSync(fn);
      const etag = `"${sha1(buf)}"`;
      resp.set("ETag", etag);
      const ifNoneMatch = req.headers["if-none-match"];
      if (ifNoneMatch === etag) {
        resp.status(304).end();
      } else {
        resp.send(buf);
      }
    });
    app.listen(port);
    console.log(`🏡  Ready at http://localhost:${port}`);
    const argv = process.argv
      .slice(1)
      .filter((arg) => arg !== "-w" && arg !== "--watch");
    watch(baseSrcDir, { recursive: true, delay: 350 }, function (_, fn) {
      if (fn.includes("src/icons.css")) {
        // ignore this since it's generated
        return;
      }
      console.log("🏓  %s changed.", fn);
      spawnSync(process.argv[0], argv, { stdio: "inherit" });
    });
  }
})();
