import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { exec as _exec } from "node:child_process";
import fetch from "node-fetch";
import findNodeModules from "find-node-modules";

export const MAX_BUFFER = 5000000; // ~5MB
export const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const getBuilderVersion = () => {
  const fn = path.join(__dirname, "../../package.json");
  if (fs.existsSync(fn)) {
    const pkg = JSON.parse(fs.readFileSync(fn));
    return pkg.version;
  }
};

export const error = (msg) => {
  console.error(msg);
  process.exit(1);
};

export const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

export const ensureExists = (fn, read) => {
  if (fn && !fs.existsSync(fn)) {
    console.error("File does not exist: " + fn);
    process.exit(1);
  }
  if (fn && read) {
    return fs.readFileSync(fn, "utf8").toString();
  }
};

export const rmDir = (dir) => {
  if (fs.existsSync(dir)) {
    fs.rmdirSync(dir, { recursive: true });
  }
};

export const writeJSON = (fn, data) => {
  fs.writeFileSync(fn, JSON.stringify(data, null, 2));
};

export const apiRequest = async (host, path) => {
  const resp = await fetch(`https://${host}${path}`);
  const value = await resp.json();
  if (resp.status !== 200 || !value.success) {
    throw new Error(value.message || `invalid response from server at ${path}`);
  }
  const { success, ...rest } = value;
  return rest;
};

export const debugLog = (debug, msg, o) =>
  !debug
    ? null
    : console.log.apply(
        console,
        [`🚧  ${msg}`, o ? JSON.stringify(o) : undefined].filter(Boolean)
      );

export const verbose = (quiet, msg) =>
  quiet ? null : console.log(`✅   ${msg}`);

const node_modules = findNodeModules();

export const findBin = (name) => {
  for (let c = 0; c < node_modules.length; c++) {
    const fn = path.join(node_modules[c], ".bin", name);
    if (fs.existsSync(fn)) {
      return fn;
    }
  }
  throw new Error(
    `couldn't find binary ${name} in any of ${node_modules.join(", ")}`
  );
};

const exec = (fn, args, opts) => {
  return new Promise((resolve, reject) => {
    const cmd = `${fn} ${args.join(" ")}`;
    _exec(cmd, { ...opts, maxBuffer: MAX_BUFFER }, (err, stdout, stderr) => {
      if (err) {
        return reject(err);
      }
      if (stderr.length) {
        return reject(new Error(stderr));
      }
      resolve(stdout);
    });
  });
};

const htmlMinifier = findBin("html-minifier");

export const minifyHTML = (fn) => {
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
