import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import ssri from "ssri";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import Handlebars from "handlebars";
import { library, dom, icon } from "@fortawesome/fontawesome-svg-core";
import { fas } from "@fortawesome/free-solid-svg-icons";
import { fab } from "@fortawesome/free-brands-svg-icons";
import { far } from "@fortawesome/free-regular-svg-icons";
import humanize from "humanize-plus";
import { findBin, __dirname, MAX_BUFFER, debugLog } from "./util.mjs";

const cache = {};

const uglifyjs = findBin("uglifyjs");
const tailwind = findBin("tailwindcss");

const _tailwindCfg = path.join(__dirname, "../../tailwind.config.js");
if (!fs.existsSync(_tailwindCfg)) {
  throw new Error(`couldn't find required file at ${_tailwindCfg}`);
}
let tailwindCfg;

const compileCSSAndFixHTML = (distDir, staticDistDir, webSrcDir, srcDir) => {
  const globalCSS = path.join(webSrcDir, "global.css");
  const themeCSS = path.join(srcDir, "theme.css");
  const baseCSS = path.join(webSrcDir, "..", "theme", "default", "theme.css");
  let cssBuf = fs.readFileSync(globalCSS).toString();
  // pull in the base theme to allow a theme to just override specific variables
  // but inherit the base theme values
  cssBuf += fs.readFileSync(baseCSS).toString();
  if (fs.existsSync(themeCSS)) {
    const themeBuf = fs.readFileSync(themeCSS).toString();
    cssBuf += "\n" + themeBuf;
  }
  cssBuf += "\n" + dom.css();
  const outfn = path.join(staticDistDir, "global.css");
  fs.writeFileSync(outfn, cssBuf);
  const { relpath, sha } = generateFileSSRI(
    distDir,
    webSrcDir,
    path.dirname(staticDistDir),
    staticDistDir,
    "global.css",
    outfn,
    srcDir
  );
  return {
    GLOBAL_CSS_HREF: relpath,
    GLOBAL_CSS_SHA: sha,
  };
};

const minifyCSS = (fn, distDir) => {
  const tmpfn = path.join(
    os.tmpdir(),
    path.basename(fn) + "-" + String(Date.now()) + ".css"
  );
  try {
    const args = ["-i", fn, "-o", tmpfn, "--jit", "-m", "-c", tailwindCfg];
    // console.log(tailwind, args);
    let res = spawnSync(tailwind, args, {
      maxBuffer: MAX_BUFFER,
      cwd: distDir,
    });
    // console.log(res);
    if (res.status !== 0) {
      throw new Error(`error compiling CSS: ${fn}. ${res.stderr}`);
    }
    if (fs.existsSync(tmpfn)) {
      return fs.readFileSync(tmpfn);
    }
    throw new Error(`error compiling CSS: ${fn}. ${res.stderr}`);
  } finally {
    fs.existsSync(tmpfn) && fs.unlinkSync(tmpfn);
  }
};

const minifyJS = (fn, distDir) => {
  const res = spawnSync(uglifyjs, [fn], {
    maxBuffer: MAX_BUFFER,
    cwd: distDir,
  });
  if (res.status !== 0) {
    throw new Error(`error compressing JS: ${fn}. ${res.stderr}`);
  }
  return res.stdout;
};

export const sha1 = (buf) =>
  crypto.createHash("sha1").update(buf).digest("hex");

const generateFileSSRI = (
  distDir,
  baseSrcDir,
  srcDir,
  staticDistDir,
  href,
  fn
) => {
  fn = fn || path.join(srcDir, href);
  if (!fs.existsSync(fn)) {
    fn = path.join(baseSrcDir, href);
    if (!fs.existsSync(fn)) {
      throw new Error(`couldn't find css file at ${fn} (href)`);
    }
  }
  let buf = fs.readFileSync(fn);
  const _sha = sha1(buf);
  const cachekey = fn + _sha;
  let entry = cache[cachekey];
  if (entry) {
    return entry;
  }
  switch (path.extname(fn)) {
    case ".css": {
      buf = minifyCSS(fn, distDir);
      break;
    }
    case ".js": {
      buf = minifyJS(fn, distDir);
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
  const subsha = _sha.substring(0, 6);
  const _name = `${tok[0]}.${subsha}.${sha.substring(sha.length - 6)}.${tok
    .slice(1)
    .join(".")}`.replace(/[\/=+]/g, "");
  const staticName = path.basename(staticDistDir);
  const relpath = `/${staticName}/${_name}`;
  entry = { relpath, sha };
  cache[cachekey] = entry;
  const outfn = path.join(staticDistDir, _name);
  fs.writeFileSync(outfn, buf);
  return entry;
};

export const registerHelpers = ({
  baseSrcDir,
  webSrcDir,
  emailSrcDir,
  srcDir,
  distDir,
  staticDistDir,
  host,
  flags,
  config,
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

  debugLog(flags.debug, "base src directory: " + srcDir);
  debugLog(flags.debug, "web src directory: " + webSrcDir);

  const purge = JSON.stringify([
    webSrcDir + "/*.html",
    webSrcDir + "/*.css",
    webSrcDir + "/*.hbs",
    webSrcDir + "/*.js",
    srcDir + "/*.css",
    srcDir + "/*.hbs",
    srcDir + "/*.html",
  ]);
  debugLog(flags.debug, "purge folders: " + purge);

  const jsBuf = before + "purge: " + purge + "," + after;

  // the JS file must be relative to the node_modules folder so we need to symlink
  const distNodeModulesDir = path.resolve(path.join(distDir, "node_modules"));
  fs.symlinkSync(
    path.resolve(path.join(__dirname, "../../node_modules/")),
    distNodeModulesDir
  );

  // write out the generated tailwind
  tailwindCfg = path.join(distDir, "tailwind.generated.config.js");
  fs.writeFileSync(tailwindCfg, jsBuf);
  debugLog(flags.debug, "wrote tailwind to: " + tailwindCfg);

  try {
    const globals = compileCSSAndFixHTML(
      distDir,
      staticDistDir,
      webSrcDir,
      srcDir
    );

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

    Handlebars.registerHelper("add", function (v1, v2) {
      if (isNaN(v1) || isNaN(v2)) {
        throw new Error("operands must be numbers");
      }
      return v1 + v2;
    });

    Handlebars.registerHelper("subtract", function (v1, v2) {
      if (isNaN(v1) || isNaN(v2)) {
        throw new Error("operands must be numbers");
      }
      return v1 - v2;
    });

    Handlebars.registerHelper("eq", function (v1, v2, options) {
      if (v1 === v2) {
        return options.fn(this);
      }
      return options.inverse(this);
    });

    Handlebars.registerHelper("gt", function (v1, v2, options) {
      if (v1 > v2) {
        return options.fn(this);
      }
      return options.inverse(this);
    });

    Handlebars.registerHelper("gte", function (v1, v2, options) {
      if (v1 >= v2) {
        return options.fn(this);
      }
      return options.inverse(this);
    });

    Handlebars.registerHelper("lt", function (v1, v2, options) {
      if (v1 < v2) {
        return options.fn(this);
      }
      return options.inverse(this);
    });

    Handlebars.registerHelper("lte", function (v1, v2, options) {
      if (v1 <= v2) {
        return options.fn(this);
      }
      return options.inverse(this);
    });

    Handlebars.registerHelper("len", function (arg) {
      if (Array.isArray(arg)) {
        return arg.length;
      }
      return 0;
    });

    Handlebars.registerHelper("empty", function (arg) {
      if (Array.isArray(arg)) {
        return arg.length === 0;
      }
      return true;
    });

    Handlebars.registerHelper("last", function (arg) {
      if (Array.isArray(arg)) {
        return arg[arg.length - 1];
      }
      throw new Error("last must be called with an array");
    });

    Handlebars.registerHelper("after", function (arg, index, length) {
      if (Array.isArray(arg)) {
        return arg.slice(
          index,
          typeof length === "number" ? index + length : undefined
        );
      }
      throw new Error("after must be called with an array");
    });

    Handlebars.registerHelper("pick", function (arg, index, offset = 0) {
      if (Array.isArray(arg)) {
        return arg.slice(offset)[index];
      }
      throw new Error("pick must be called with an array");
    });

    Handlebars.registerHelper("include", function (arg) {
      const baseDir =
        arg.hash.base === "web" || !arg.hash.base ? webSrcDir : emailSrcDir;
      let fn = path.resolve(baseDir, arg.hash.src);
      let insideOverride = false;
      const overrideFn = path.resolve(
        srcDir,
        (arg.hash.base || "web") + "_" + arg.hash.src
      );
      // attempt to see if we have a template override and if so, just use
      // that one instead of the default one
      if (!arg.data.root.insideOverride && fs.existsSync(overrideFn)) {
        fn = overrideFn;
        insideOverride = true;
      }
      if (!fs.existsSync(fn)) {
        // in the case the theme directory is in a different dir tree
        // then we try and resolve included files as if they were in the
        // same source tree
        fn = path.resolve(baseSrcDir, "theme", "default", arg.hash.src);
        if (!fs.existsSync(fn)) {
          // this is for backwards compat before we had
          // src/web directory
          if (arg.hash.src.indexOf("../../") === 0) {
            fn = path.resolve(webSrcDir, arg.hash.src.substring(6));
            if (!fs.existsSync(fn)) {
              throw new Error(`couldn't include file ${fn}`);
            }
          }
        }
      }
      const context = {
        ...arg.data.root,
        ...(arg.hash.context || {}),
        ...globals,
        insideOverride,
      };
      const keys = Object.keys(arg.hash).filter(
        (k) => k !== "src" && k !== "context"
      );
      keys.forEach((key) => (context[key] = arg.hash[key]));
      const buf = fs.readFileSync(fn).toString();
      return new Handlebars.SafeString(Handlebars.compile(buf)(context));
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

    Handlebars.registerHelper("script", function (href) {
      const { relpath, sha } = generateFileSSRI(
        distDir,
        webSrcDir,
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
      let preamble = "";
      if (config.web.features.themeSwitcher) {
        preamble = `if (
            localStorage.theme === "dark" ||
            (!("theme" in localStorage) &&
              window.matchMedia("(prefers-color-scheme: dark)").matches)
          ) {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }`;
      }
      return new Handlebars.SafeString(`<script>
    ${preamble}
    window.apiURL = "${host}";
    window.siteId = "${siteId}";
    window.changelogId = "${changelogId}";
    window.changelogIds = ${JSON.stringify(changelogIds)};
  </script>`);
    });

    Handlebars.registerHelper("iso_date", function (v) {
      if (typeof v === "number") {
        return new Date(v).toISOString();
      }
      if (typeof v === "object" && v instanceof Date) {
        return v.toISOString();
      }
      return new Date().toISOString();
    });

    Handlebars.registerHelper("cover_image_url", function (changelog) {
      if (changelog.cover_image) {
        const u = new URL(changelog.cover_image);
        u.searchParams.set("rw", "1200");
        u.searchParams.set("rh", "628");
        return new Handlebars.SafeString(u.toString());
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

      return new Handlebars.SafeString(`<svg
  width="${width}"
  height="${height}"
  viewBox="0 0 277 297"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  role="img"
>
  <path
    fillRule="evenodd"
    clipRule="evenodd"
    d="M95.7878 296.635H128.664V296.654C210 296.654 276.157 230.116 276.157 148.332C276.157 66.5476 210 0.00958123 128.659 0H128.483L118.744 0.114995C53.2636 0.1677 0 53.7546 0 119.617C0.000695153 144.543 7.7522 168.845 22.1694 189.121C36.5867 209.397 56.9479 224.632 80.4028 232.694L80.541 232.732V281.302C80.541 285.369 82.1474 289.269 85.0067 292.144C87.866 295.019 91.7441 296.635 95.7878 296.635ZM118.996 31.8291L128.749 31.7141C193.243 31.762 245.702 84.5199 245.702 149.414C245.702 214.309 193.196 267.105 128.664 267.105H110.996V237.495H130.698C175.266 237.495 211.525 201.032 211.525 156.213V150.272C211.525 111.011 179.759 79.0673 140.718 79.0673H95.783C91.7393 79.0673 87.8612 80.6827 85.0019 83.5581C82.1426 86.4335 80.5362 90.3333 80.5362 94.3998V175.312C85.8678 181.89 96.8264 186.687 106.832 186.96H110.996V109.713H140.704C151.401 109.724 161.658 114.003 169.222 121.609C176.787 129.215 181.043 139.529 181.055 150.286V156.213C181.04 169.647 175.726 182.525 166.278 192.022C156.831 201.518 144.023 206.858 130.665 206.868H103.773C94.9191 206.378 86.2752 203.967 78.435 199.801C49.3804 184.943 30.4411 154.886 30.4411 120.704C30.4411 71.6982 70.0874 31.8291 118.82 31.8291H118.996Z"
    fill="currentColor"
  />
</svg>`);
    });

    return () => fs.existsSync(tailwindCfg) && fs.unlinkSync(tailwindCfg);
  } finally {
    // remove the symlink
    fs.unlinkSync(distNodeModulesDir);
  }
};
