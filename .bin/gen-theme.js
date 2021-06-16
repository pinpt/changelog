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
  console.error("Usage: [options] theme_name");
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

const baseThemeDir = path.resolve(path.join(__dirname, "../src/theme/default"));
const isSourceDir = fs.existsSync(baseThemeDir);

const outDir = path.resolve(
  args["--output"] ||
    (isSourceDir
      ? path.join(__dirname, "../src/theme", theme)
      : path.join(process.cwd(), theme))
);

!fs.existsSync(outDir) && fs.mkdirSync(outDir, { recursive: true });

// copy the files
fs.readdirSync(baseThemeDir)
  .filter((fn) => /\.(html|css)$/.test(path.extname(fn)))
  .forEach((name) => {
    const fn = path.join(baseThemeDir, name);
    const dst = path.join(outDir, name);
    fs.copyFileSync(fn, dst);
    verbose(`Copied ${fn}`);
  });

verbose(`Generated theme to ${outDir}`);
