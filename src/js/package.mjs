import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import _build from "./build.mjs";
import { ensureDir, rmDir, verbose } from "./util.mjs";

export default {
  description: "Package your theme for distribution",
  flags: {
    theme: _build.flags.theme,
    output: _build.flags.output,
    quiet: _build.flags.quiet,
    debug: _build.flags.debug,
  },
  run: async (_args, flags) => {
    ensureDir(flags.output);
    const tmpDir = fs.mkdtempSync("changelog");
    process.on("exit", () => rmDir(tmpDir));
    const outZipFile = path.join(flags.output, "theme.zip");
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
