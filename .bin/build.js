#!/usr/bin/env node

const path = require("path");
const fs = require("fs");
const mimetype = require("mimetype");
const express = require("express");
const spawnSync = require("child_process").spawnSync;
const fetch = require("node-fetch");
const Handlebars = require("handlebars");
const arg = require("arg");
const watch = require("node-watch");
const { registerHelpers } = require("./helpers");

const error = (msg) => {
  console.error(msg);
  process.exit(1);
};

const verbose = (msg) => (quiet ? null : console.log(`✅   ${msg}`));

const help = () => {
  console.error("Usage: [options] site [theme]");
  console.error();
  console.error("Options:");
  console.error();
  console.error("-h, --help         Output usage information");
  console.error("-q, --quiet        Don't log anything except errors");
  console.error("-o, --output       Output to directory instead of ./dist");
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
  "-q": "--quiet",
  "-h": "--host",
  "-f": "--file",
  "-o": "--output",
  "-w": "--watch",
  "-p": "--port",
});

const site = args["_"][0];
const theme = args["_"][1] || "default";
const port = args["--port"] || 4444;

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
  args["--output"] || path.join(__dirname, "../dist")
);

const baseSrcDir = path.join(__dirname, "../src");
const srcDir = path.join(baseSrcDir, "theme", theme);

const cssFiles = [
  path.join(baseSrcDir, "global.css"),
  path.join(srcDir, "theme.css"),
];

const tailwindCLI = path.join(
  __dirname,
  "../node_modules",
  ".bin",
  "tailwindcss-cli"
);

if (!fs.existsSync(srcDir)) {
  error(`cannot find theme at ${srcDir}`);
}

if (!fs.existsSync(tailwindCLI)) {
  error(
    `Couldn't find the tailwind cli at ${tailwindCLI}. Did you run npm install?`
  );
}

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const staticDistDir = path.join(distDir, "static");
if (!fs.existsSync(staticDistDir)) {
  fs.mkdirSync(staticDistDir, { recursive: true });
}

registerHelpers({ baseSrcDir, distDir, srcDir, host, staticDistDir });

const createTemplate = (name) => {
  const fn = path.join(srcDir, name);
  if (!fs.existsSync(fn)) {
    error(`Couldn't find template at ${fn}`);
  }
  const buf = fs.readFileSync(fn);
  return Handlebars.compile(buf.toString());
};

const minifyHTML = (fn) => {
  const res = spawnSync(
    path.join(__dirname, "../node_modules/.bin", "html-minifier"),
    [
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
    ]
  );
  if (res.status !== 0) {
    throw new Error(`error minifying ${fn}. ${res.stderr}`);
  }
  return res.stdout;
};

const processIndex = (site, changelogs) => {
  const indexTemplate = createTemplate("index.html");
  const buf = indexTemplate({
    site,
    changelogs,
    url: site.url,
  });
  const fn = path.join(distDir, "index.html");
  fs.writeFileSync(fn, buf);
  const out = minifyHTML(fn);
  fs.writeFileSync(fn, out);
  verbose(`Generated ${fn}`);
};

const processPage = (site, changelog) => {
  const pageTemplate = createTemplate("page.html");
  const buf = pageTemplate({
    site,
    changelog,
    url: changelog.url,
  });
  const basefn = path.join(distDir, "entry", changelog.id + ".html");
  // console.log(basefn, buf.toString());
  const dir = path.dirname(basefn);
  !fs.existsSync(dir) && fs.mkdirSync(dir, { recursive: true });
  const fn = path.join(basefn);
  fs.writeFileSync(fn, buf);
  const out = minifyHTML(fn);
  fs.writeFileSync(fn, out);
  verbose(`Generated ${fn}`);
};

const field = site.includes(".") ? "hostname.value" : "slug";
const url = `https://${host}/changelog/list/${site}/${field}?html=true&stats=true`;

const generate = (changelogs, site) => {
  changelogs.forEach((changelog) => {
    processPage(site, changelog);
  });
  processIndex(site, changelogs); // must come after the others
};

const generateCSS = (fn) => {
  // let deleteFile = false;
  // if (path.basename(fn) === "global.css") {
  //   const buf = fs.readFileSync(fn).toString() + "\n" + dom.css();
  //   const tmpfile = path.join(os.tmpdir(), path.basename(fn));
  //   fs.writeFileSync(tmpfile, buf);
  //   fn = tmpfile;
  //   deleteFile = true;
  // }
  // const outfn = path.join(distDir, path.basename(fn));
  // const { stderr, status } = spawnSync(tailwindCLI, ["build", fn, "-o", outfn]);
  // if (status !== 0) {
  //   console.error(fn);
  //   console.error(stderr.toString());
  // } else {
  //   verbose(`Generated ${outfn}`);
  // }
  // if (deleteFile) {
  //   fs.unlinkSync(fn);
  // }
};

const processJS = (fn) => {
  // const outfn = path.join(distDir, path.basename(fn));
  // const buf = fs.readFileSync(fn);
  // fs.writeFileSync(outfn, buf);
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
  } else {
    const resp = await fetch(url);
    const body = await resp.json();
    if (!body.success) {
      error(`Error fetching changelogs. ${body.message}`);
    }
    changelogs = body.changelogs;
    site = body.site;
  }
  // console.log({ changelogs: changelogs.map((ch) => ch.stats) });
  site.url = `https://${
    site.hostname && site.hostname.value
      ? site.hostname.value
      : `${site.slug}.changelog.so`
  }`;
  function compileAllCSSFiles() {
    cssFiles.forEach((fn) => {
      if (!fs.existsSync(fn)) {
        error(`${fn} does not exist`);
      }
      generateCSS(fn);
    });
  }
  compileAllCSSFiles();
  // processJS(path.join(baseSrcDir, "global.js"));
  // processJS(path.join(baseSrcDir, "theme.js"));
  generate(changelogs, site, url);
  if (args["--watch"]) {
    console.log(`🏁  Watching for changes in ${srcDir}`);
    const app = express();
    app.get("/", (req, resp) => {
      fn = path.join(distDir, "index.html");
      resp.set("Content-Type", "text/html");
      resp.set("Cache-Control", "max-age=0, no-cache");
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
      resp.set("Content-Disposition", "inline");
      resp.set("Cache-Control", "max-age=0, no-cache");
      const buf = fs.readFileSync(fn);
      resp.send(buf);
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
