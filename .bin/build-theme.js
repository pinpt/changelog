#!/usr/bin/env node

const path = require("path");
const fs = require("fs");
const arg = require("arg");
const child_process = require("child_process");

const error = (msg) => {
  console.error(msg);
  process.exit(1);
};

const verbose = (msg) => (quiet ? null : console.log(`✅   ${msg}`));

const help = () => {
  console.error("Usage: [options] theme");
  console.error();
  console.error("Options:");
  console.error();
  console.error("-h, --help         Output usage information");
  console.error("-q, --quiet        Don't log anything except errors");
  console.error("-o, --output       Output to directory instead of ./");
  console.error();
  process.exit(0);
};

const args = arg({
  "--help": Boolean,
  "--quiet": Boolean,
  "--output": String,
  "-q": "--quiet",
  "-o": "--output",
});

const theme = args["_"][0];
const quiet = args["--quiet"];

if (!theme || args["--help"]) {
  if (!args["--help"]) {
    console.error("🛑 missing your theme name as an argument");
  }
  console.error();
  help();
}

const themeDir = path.resolve(path.join(__dirname, "../src/theme", theme));

if (!fs.existsSync(themeDir)) {
  error(`Couldn't find theme at ${themeDir}`);
}

const outDir = path.resolve(
  args["--output"] || path.join(process.cwd(), "dist")
);

!fs.existsSync(outDir) && fs.mkdirSync(outDir, { recursive: true });

const outZipFile = path.join(outDir, `${theme}.zip`);

const tmpDir = fs.mkdtempSync("changelog-gen");
process.on("exit", () => fs.rmdirSync(tmpDir, { recursive: true }));

// copy the files
fs.readdirSync(themeDir)
  .filter((fn) => /\.(html|css)$/.test(path.extname(fn)))
  .forEach((name) => {
    const fn = path.join(themeDir, name);
    const dst = path.join(tmpDir, name);
    fs.copyFileSync(fn, dst);
    verbose(`Copied ${fn}`);
  });

child_process.execSync(`zip -r ${outZipFile} *`, {
  cwd: tmpDir,
});

verbose(`Generated ${outZipFile}`);
