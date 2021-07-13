import path from "node:path";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import _build from "./build.mjs";
import fswatch from "node-watch";
import express from "express";
import mimetype from "mimetype";
import compression from "compression";
import { sha1 } from "./handlebars.mjs";
import { __dirname, ensureDir } from "./util.mjs";

export default {
  description: "Build your theme for local development",
  flags: Object.assign({}, _build.flags, {
    port: {
      description: "The port to listen on for the local dev server",
      type: "number",
      default: 4444,
      isRequired: false,
    },
  }),
  run: async (_args, flags) => {
    const distDir = flags.output;
    const baseSrcDir = path.join(__dirname, "..");
    const webDir = path.join(baseSrcDir, "web");
    const emailDir = path.join(baseSrcDir, "email");
    const baseThemeDir = path.join(baseSrcDir, "theme", "base");
    const srcDir = path.resolve(flags.theme || baseThemeDir);
    const staticDistDir = path.join(distDir, "static");
    const emailDistDir = path.join(distDir, "email");
    ensureDir(staticDistDir);
    ensureDir(emailDistDir);
    const watchDirs = [srcDir, webDir, emailDir];
    await _build.run([], flags);
    console.log(`🏁  Watching for changes in ${srcDir}`);
    const app = express();
    app.use(compression());
    app.get("/", (_req, resp) => {
      const fn = path.join(distDir, "index.html");
      resp.set("Content-Type", "text/html");
      resp.set(
        "Cache-Control",
        "public, max-age=0, must-revalidate, stale-if-error=0"
      );
      resp.send(fs.readFileSync(fn));
    });
    app.get("/entries", (req, resp) => {
      if (req.query.page && req.query.page !== "1") {
        const fn = path.join(distDir, "index_" + req.query.page + ".html");
        if (!fs.existsSync(fn)) {
          resp.status(404).end();
          return;
        }
        resp.set("Content-Type", "text/html");
        resp.set(
          "Cache-Control",
          "public, max-age=0, must-revalidate, stale-if-error=0"
        );
        resp.send(fs.readFileSync(fn));
      } else {
        resp.redirect("/");
        return;
      }      
    });
    app.get("/search", (_req, resp) => {
      const fn = path.join(distDir, "search.html");
      resp.set("Content-Type", "text/html");
      resp.set(
        "Cache-Control",
        "public, max-age=0, must-revalidate, stale-if-error=0"
      );
      resp.send(fs.readFileSync(fn));
    });
    app.get("/a.js", (_req, resp) => resp.status(200).end());
    app.get("/entry/:id/:title?", (req, resp) => {
      const fn = path.join(distDir, "entry", req.params.id + ".html");
      resp.set("Content-Type", "text/html");
      resp.set("Cache-Control", "max-age=0, no-cache");
      resp.send(fs.readFileSync(fn));
    });
    app.get("/email/:id", (req, resp) => {
      const fn = path.join(emailDistDir, req.params.id + ".html");
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
    app.listen(flags.port);
    console.log(`🏡  Ready at http://localhost:${flags.port}`);
    watchDirs.forEach((dir) => {
      console.log("👀 ... " + dir);
      fswatch(dir, { recursive: false, delay: 350 }, function (_, fn) {
        if (fn.includes("src/icons.css")) {
          // ignore this since it's generated
          return;
        }
        console.log("🏓  %s changed.", fn);
        if (fn.includes("email/") || fn.includes("email.html")) {
          const argv = [
            process.argv[1],
            "build",
            ...process.argv.slice(3),
            "--email",
            "--no-index",
            "--input",
            path.join(distDir, "data.json"),
          ];
          spawnSync(process.argv[0], argv, { stdio: "inherit" });
          return;
        }
        _build.run([], flags);
      });
    });
  },
};
