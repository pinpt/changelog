const ssri = require("ssri");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const spawnSync = require("child_process").spawnSync;
const Handlebars = require("handlebars");
const library = require("@fortawesome/fontawesome-svg-core").library;
const dom = require("@fortawesome/fontawesome-svg-core").dom;
const icon = require("@fortawesome/fontawesome-svg-core").icon;
const fas = require("@fortawesome/free-solid-svg-icons").fas;
const fab = require("@fortawesome/free-brands-svg-icons").fab;
const far = require("@fortawesome/free-regular-svg-icons").far;
const humanize = require("humanize-plus");
const findNodeModules = require("find-node-modules");

const node_modules = findNodeModules();

const findBin = (name) => {
  for (let c = 0; c < node_modules.length; c++) {
    const fn = path.join(node_modules[c], ".bin", name);
    if (fs.existsSync(fn)) {
      return fn;
    }
  }
  throw new Error(
    `couldn't find binary ${bin} in any of ${node_modules.join(", ")}`
  );
};
exports.findBin = findBin;

const cache = {};

const uglifycss = findBin("uglifycss");
const uglifyjs = findBin("uglifyjs");
const tailwind = findBin("tailwindcss-cli");

const _tailwindCfg = path.join(__dirname, "../tailwind.config.js");
if (!fs.existsSync(_tailwindCfg)) {
  throw new Error(`couldn't find required file at ${_tailwindCfg}`);
}
let tailwindCfg;

const minifyCSS = (fn) => {
  const tmpfn = path.join(
    os.tmpdir(),
    path.basename(fn) + "-" + String(Date.now()) + ".css"
  );
  try {
    let res = spawnSync(tailwind, [
      "build",
      fn,
      "-o",
      tmpfn,
      "-c",
      tailwindCfg,
    ]);
    if (res.status !== 0) {
      throw new Error(`error compiling CSS: ${fn}. ${res.stderr}`);
    }
    res = spawnSync(uglifycss, [tmpfn]);
    if (res.status !== 0) {
      throw new Error(`error compressing CSS: ${fn}. ${res.stderr}`);
    }
    return res.stdout;
  } finally {
    fs.existsSync(tmpfn) && fs.unlinkSync(tmpfn);
  }
};

const minifyJS = (fn) => {
  const res = spawnSync(uglifyjs, [fn]);
  if (res.status !== 0) {
    throw new Error(`error compressing JS: ${fn}. ${res.stderr}`);
  }
  return res.stdout;
};

const sha1 = (buf) => crypto.createHash("sha1").update(buf).digest("hex");
exports.sha1 = sha1;

const generateFileSSRI = (baseSrcDir, srcDir, staticDistDir, href) => {
  let fn = path.join(srcDir, href);
  if (!fs.existsSync(fn)) {
    fn = path.join(baseSrcDir, href);
    if (!fs.existsSync(fn)) {
      throw new Error(`couldn't find css file at ${fn} (href)`);
    }
  }
  let buf = fs.readFileSync(fn).toString();
  if (buf.trim().length === 0) {
    return {
      relpath: "",
      sha: "",
    };
  }
  const _sha = sha1(buf);
  const cachekey = fn + _sha;
  let entry = cache[cachekey];
  if (entry) {
    return entry;
  }
  switch (path.extname(fn)) {
    case ".css": {
      buf = minifyCSS(fn);
      break;
    }
    case ".js": {
      buf = minifyJS(fn);
      break;
    }
  }
  const integrity = ssri
    .create({ algorithms: ["sha384"] })
    .update(buf)
    .digest();
  const sha = integrity.toString();
  const name = path.basename(href);
  const tok = name.split(".");
  const _name = `${tok[0]}.${_sha.substring(0, 6)}.${tok.slice(1).join(".")}`;
  const staticName = path.basename(staticDistDir);
  const relpath = `/${staticName}/${_name}`;
  entry = { relpath, sha };
  cache[cachekey] = entry;
  const outfn = path.join(staticDistDir, _name);
  fs.writeFileSync(outfn, buf);
  return entry;
};

exports.registerHelpers = ({
  baseSrcDir,
  srcDir,
  distDir,
  staticDistDir,
  host,
}) => {
  // Adds all the icons from the Solid style into our library for easy lookup
  library.add(fas, fab, far);

  // we need to write in the purge folders based on where we
  // read in the theme since it could be in a different place
  // than our generated folder and we'll run into purge issues if so
  const tailwindCfgJS = fs.readFileSync(_tailwindCfg).toString();
  const startIndex = tailwindCfgJS.indexOf("purge:");
  const endIndex = tailwindCfgJS.indexOf("]", startIndex);
  const before = tailwindCfgJS.substring(0, startIndex);
  const after = tailwindCfgJS.substring(endIndex + 2);

  const jsBuf =
    before +
    "purge: " +
    JSON.stringify([
      baseSrcDir + "/*.html",
      baseSrcDir + "/*.css",
      baseSrcDir + "/*.hbs",
      baseSrcDir + "/*.js",
      srcDir + "/*.css",
      srcDir + "/*.hbs",
      srcDir + "/*.html",
    ]) +
    "," +
    after;

  // write out the generated tailwind
  tailwindCfg = path.join(distDir, "tailwind.generated.config.js");
  fs.writeFileSync(tailwindCfg, jsBuf);

  Handlebars.registerHelper("formatNumber", function (arg, arg2) {
    return humanize.formatNumber(arg, arg2);
  });

  Handlebars.registerHelper("compactInteger", function (arg, arg2) {
    return humanize.compactInteger(arg, arg2);
  });

  Handlebars.registerHelper("boundedNumber", function (arg, arg2) {
    return humanize.boundedNumber(arg, arg2);
  });

  Handlebars.registerHelper("fileSize", function (arg, arg2) {
    return humanize.fileSize(arg, arg2);
  });

  Handlebars.registerHelper("truncate", function (arg, arg2, arg3) {
    return humanize.truncate(arg, arg2, arg3);
  });

  Handlebars.registerHelper("truncateWords", function (arg, arg2) {
    return humanize.truncateWords(arg, arg2);
  });

  Handlebars.registerHelper("capitalize", function (arg, arg2) {
    return humanize.capitalize(arg, arg2);
  });

  Handlebars.registerHelper("titleCase", function (arg) {
    return humanize.titleCase(arg);
  });

  Handlebars.registerHelper("pathname", function (arg) {
    const { pathname } = new URL(arg);
    return pathname;
  });

  Handlebars.registerHelper("first", function (arg) {
    if (Array.isArray(arg)) {
      return arg[0];
    }
    throw new Error("first must be called with an array");
  });

  Handlebars.registerHelper("last", function (arg) {
    if (Array.isArray(arg)) {
      return arg[arg.length - 1];
    }
    throw new Error("last must be called with an array");
  });

  Handlebars.registerHelper("after", function (arg, index, length) {
    if (Array.isArray(arg)) {
      return arg.slice(index, typeof length === "number" ? length : undefined);
    }
    throw new Error("after must be called with an array");
  });

  Handlebars.registerHelper("include", function (arg) {
    let fn = path.resolve(srcDir, arg.hash.src);
    if (!fs.existsSync(fn)) {
      // in the case the theme directory is in a different dir tree
      // then we try and resolve included files as if they were in the
      // same source tree
      fn = path.resolve(baseSrcDir, "theme", "default", arg.hash.src);
      if (!fs.existsSync(fn)) {
        throw new Error(`couldn't include file ${fn}`);
      }
    }
    let context = { ...arg.data.root, ...(arg.hash.context || {}) };
    const keys = Object.keys(arg.hash).filter(
      (k) => k !== "src" && k !== "context"
    );
    keys.forEach((key) => (context[key] = arg.hash[key]));
    const buf = fs.readFileSync(fn).toString();
    return new Handlebars.SafeString(Handlebars.compile(buf)(context));
  });

  Handlebars.registerHelper("fontawesome-css", function () {
    const href = "/icons.css";
    fs.writeFileSync(path.join(baseSrcDir, href), dom.css());
    const { relpath, sha } = generateFileSSRI(
      baseSrcDir,
      srcDir,
      staticDistDir,
      href
    );
    return new Handlebars.SafeString(
      `<link rel="stylesheet" type="text/css" href="${relpath}" integrity="${sha}" crossorigin="anonymous" />`
    );
  });

  Handlebars.registerHelper("fontawesome-icon", function (args) {
    const fa = icon({
      prefix: args.hash.prefix || "fas",
      iconName: args.hash.icon,
    });
    if (!fa) {
      throw new Error(
        `Couldn't find fontawesome icon: ${args.hash.icon} in ${args.hash.prefix}`
      );
    }
    return new Handlebars.SafeString(fa.html);
  });

  Handlebars.registerHelper("friendly-date", function (args) {
    return new Handlebars.SafeString(
      new Intl.DateTimeFormat().format(new Date(args))
    );
  });

  Handlebars.registerHelper("analytics-js", function (siteId, changelogId) {
    return new Handlebars.SafeString(
      `<script async defer src="/a.js" data-site-id="${siteId}" data-id="${changelogId}"></script>`
    );
  });

  Handlebars.registerHelper("css", function (href) {
    const { relpath, sha } = generateFileSSRI(
      baseSrcDir,
      srcDir,
      staticDistDir,
      href
    );
    if (relpath === "") {
      return ""; // ignore if empty
    }
    return new Handlebars.SafeString(
      `<link rel="stylesheet" type="text/css" href="${relpath}" integrity="${sha}" crossorigin="anonymous" />`
    );
  });

  Handlebars.registerHelper("script", function (href) {
    const { relpath, sha } = generateFileSSRI(
      baseSrcDir,
      srcDir,
      staticDistDir,
      href
    );
    if (relpath === "") {
      return ""; // ignore if empty
    }
    return new Handlebars.SafeString(
      `<script src="${relpath}" integrity="${sha}" async defer crossorigin="anonymous"></script>`
    );
  });

  Handlebars.registerHelper("global-js", function (args) {
    const siteId = args.data.root.site.id;
    const changelogId = args.data.root.changelog
      ? args.data.root.changelog.id
      : "";
    const changelogIds = args.data.root.changelogs
      ? args.data.root.changelogs.map((ch) => ch.id)
      : [args.data.root.changelog.id];
    return new Handlebars.SafeString(`<script>if (
    localStorage.theme === "dark" ||
    (!("theme" in localStorage) &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
    window.apiURL = "${host}";
    window.siteId = "${siteId}";
    window.changelogId = "${changelogId}";
    window.changelogIds = ${JSON.stringify(changelogIds)};
  </script>`);
  });

  Handlebars.registerHelper("iso_date", function (v) {
    return new Date(v).toISOString();
  });

  Handlebars.registerHelper("cover_image_url", function (changelog) {
    if (changelog.cover_image) {
      return changelog.cover_image;
    }
    return "";
  });

  Handlebars.registerHelper("author", function (changelog) {
    if (changelog.authors) {
      return changelog.authors
        .map((author) => `${author.firstName} ${author.lastName}`)
        .join(" and ");
    }
    return "";
  });

  Handlebars.registerHelper("twitter_handle", function (url) {
    if (url.startsWith("@")) {
      return url;
    } else if (url.includes("twitter.com/")) {
      const u = new URL(url);
      const tok = u.pathname.substring(1).split("/");
      return `@${tok[0]}`;
    }
    return url;
  });

  Handlebars.registerHelper("logo", function (args) {
    const { width = "44", height = "42" } = args.hash;
    const id = Date.now();

    return new Handlebars.SafeString(`<svg
  width="${width}"
  height="${height}"
  viewBox="0 0 236 224"
  xmlns="http://www.w3.org/2000/svg"
  role="img"
>
  <path
    d="M173.688 223.31C173.208 223.31 172.688 223.31 172.268 223.31C158.788 222.88 145.268 217.89 131.918 208.43C122.208 215.63 110.918 220.98 96.5585 220.98H96.4985C56.4085 220.98 24.4984 198.8 8.95842 160.24C-9.27158 115.02 0.958435 61.31 33.8484 29.61C52.6984 11.43 85.8484 -5.48996 117.118 6.61004C122.554 8.76718 127.687 11.621 132.388 15.1C145.188 5.83003 160.848 -1.45994 178.388 0.250056C196.938 2.06006 211.278 14.74 223.998 28.16C227.478 31.83 230.788 35.5 233.068 40.16C236.128 46.44 236.478 53.25 234.018 58.83C230.298 67.26 221.458 71.83 207.728 72.5601C199.618 72.9701 188.978 72.9901 178.518 69.5601C163.358 64.5601 152.218 53.5601 141.438 43.0001C138.358 40.0001 135.328 37 132.258 34.21C129.538 36.6 127.008 38.99 124.708 41.26C104.108 61.51 93.2085 83.1 92.2984 105.43C92.2184 107.43 92.2085 109.43 92.2984 111.43C92.8984 133.97 102.198 157.19 117.808 175.15C122.126 180.148 126.766 184.858 131.698 189.25C134.528 186.61 137.358 183.79 140.278 180.89C151.038 170.17 162.158 159.09 177.498 153.8C187.918 150.2 199.698 149.65 214.498 152.09C218.498 152.76 230.818 154.77 234.808 165.32C238.518 175.15 231.808 184.41 229.318 187.89C221.458 198.75 214.068 206.47 206.038 212.18C195.958 219.4 184.508 223.31 173.688 223.31ZM143.598 198.41C153.458 204.78 163.198 208.14 172.718 208.41C180.718 208.64 189.508 205.7 197.428 200.07C204.098 195.33 210.428 188.69 217.278 179.18C221.218 173.73 221.278 171.44 220.908 170.56C220.688 169.97 219.388 167.94 212.088 166.74C199.768 164.74 190.298 165.06 182.288 167.83C170.178 172.01 160.718 181.43 150.708 191.4C148.418 193.74 146.058 196.09 143.598 198.41ZM95.1285 17.41C76.3985 17.41 57.1285 27.67 44.1285 40.23C15.4985 67.83 6.68842 114.87 22.7084 154.62C35.8684 187.28 62.7685 206.02 96.4985 206.06C105.598 206.06 113.058 203.2 119.918 198.69C115.19 194.345 110.716 189.73 106.518 184.87C88.4084 164.06 78.0584 138.11 77.3584 111.8C77.2984 109.46 77.3584 107.1 77.3584 104.8C78.5384 78.66 90.9284 53.66 114.298 30.66C116.198 28.79 118.238 26.84 120.398 24.88C117.67 23.1186 114.772 21.6345 111.748 20.45C106.449 18.4306 100.819 17.4167 95.1484 17.46L95.1285 17.41ZM144.128 24.95C146.748 27.39 149.288 29.8901 151.808 32.3701C161.808 42.1901 171.258 51.4801 183.148 55.3701C189.488 57.4701 196.828 58.18 206.948 57.67C214.388 57.3 219.158 55.56 220.388 52.78C221.058 51.25 220.788 48.88 219.678 46.6C218.318 43.81 215.938 41.19 213.188 38.29C202.438 26.96 190.598 16.2901 176.908 14.9401C165.138 13.8801 153.938 18.5301 144.178 25.0001L144.128 24.95Z"
    fill="url(#${id})"
  />
  <defs>
    <linearGradient
      id="${id}"
      x1="68.0684"
      y1="-39.2599"
      x2="154.558"
      y2="188.37"
      gradientUnits="userSpaceOnUse"
    >
      <stop offset="0.06" stop-color="#FC903C" />
      <stop offset="0.65" stop-color="#DC2546" />
      <stop offset="1" stop-color="#8C38A9" />
    </linearGradient>
  </defs>
</svg>`);
  });

  return () => fs.existsSync(tailwindCfg) && fs.unlinkSync(tailwindCfg);
};
