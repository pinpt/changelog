import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import semver from "semver";
import _build from "./build.mjs";
import { ensureDir, rmDir, verbose, ensureExists, error } from "./util.mjs";

export default {
  description: "Package your theme for distribution",
  flags: {
    theme: { ..._build.flags.theme, default: process.cwd() },
    output: _build.flags.output,
    quiet: _build.flags.quiet,
    debug: _build.flags.debug,
  },
  run: async (_args, flags) => {
    ensureDir(flags.output);
    const tmpDir = fs.mkdtempSync("changelog");
    process.on("exit", () => rmDir(tmpDir));
    const outZipFile = path.join(flags.output, "theme.zip");
    const packageJSON = path.join(flags.theme, "package.json");
    const pkg = JSON.parse(ensureExists(packageJSON, true));
    if (!pkg.changelog?.version) {
      error("missing changelog.version in package.json");
    }
    if (!semver.valid(semver.coerce(pkg.changelog.version))) {
      error(
        `invalid semver version spec (${pkg.changelog.version}) specified in your package.json. see https://semver.org/ for help`
      );
    }
    fs.readdirSync(flags.theme)
      .filter((fn) => /\.(html|css|hbs|json)$/.test(path.extname(fn)))
      .forEach((name) => {
        const fn = path.join(flags.theme, name);
        const dst = path.join(tmpDir, name);
        fs.copyFileSync(fn, dst);
        verbose(flags.quiet, `Adding ${fn}`);
      });
    execSync(`zip -r ${outZipFile} *`, {
      cwd: tmpDir,
    });
    rmDir(tmpDir);
    verbose(flags.quiet, `Packaged ${outZipFile}`);
  },
};
