import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import {
  ensureDir,
  ensureExists,
  writeJSON,
  __dirname,
  verbose,
} from "./util.mjs";
import { readPackageUpSync } from "read-pkg-up";

export default {
  description: "Create a new theme",
  flags: {
    site: {
      description: "The site name (slug)",
      type: "string",
      isRequired: true,
    },
    name: {
      description: "Name of the theme",
      type: "string",
      isRequired: true,
    },
    output: {
      description: "The output directory to create your theme",
      type: "string",
      default: process.cwd(),
      isRequired: true,
    },
  },
  run: async (_args, flags) => {
    const templateDir = path.join(__dirname, "../template");
    const outDir = path.join(flags.output, flags.name);
    ensureDir(outDir);
    fs.readdirSync(templateDir).forEach((name) => {
      const fn = path.join(templateDir, name);
      const dst = path.join(outDir, name);
      fs.copyFileSync(fn, dst);
      verbose(flags.quiet, `Generated ${dst}`);
    });
    const pkgJSON = path.join(outDir, "package.json");
    const pkg = JSON.parse(ensureExists(pkgJSON, true));
    const foundPackage = readPackageUpSync({
      cwd: dirname(fileURLToPath(import.meta.url)),
      normalize: false,
    });
    const major = foundPackage.packageJson.version.split(".")[0];
    pkg.name = flags.name;
    pkg.changelog.version = String(major);
    pkg.changelog.site = flags.site;
    Object.keys(pkg.scripts).forEach((key) => {
      let value = pkg.scripts[key];
      pkg.scripts[key] = value
        .replace("SITE", flags.site)
        .replace("VERSION", String(major));
    });
    writeJSON(pkgJSON, pkg);
  },
};
