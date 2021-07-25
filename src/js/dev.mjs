import path from "node:path";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import _build from "./build.mjs";
import fswatch from "node-watch";
import express from "express";
import mimetype from "mimetype";
import bodyParser from "body-parser";
import compression from "compression";
import fetch from "node-fetch";
import { sha1 } from "./handlebars.mjs";
import { __dirname, ensureDir, debugLog } from "./util.mjs";

const excludeHeaders = [
  "content-encoding",
  "content-length",
  "server",
  "transfer-encoding",
];
const filterHeaders = (headers) => {
  const kv = {};
  Object.keys(headers).forEach((key) => {
    const val = headers[key];
    if (val === undefined || val === null) {
      return;
    }
    kv[key] = val;
  });
  return kv;
};
const createForwarder =
  (flags, forwardURL, overridePath, addHeaders) => async (req, resp) => {
    try {
      const started = Date.now();
      const { hostname } = new URL(forwardURL);
      const _path = overridePath ? overridePath(req) : req.url;
      const _qs = req.query ? new URLSearchParams(req.query).toString() : "";
      const url = `${forwardURL}${_path}${_qs ? `?${_qs}` : ""}`;
      debugLog(flags.debug, `fowarding ${url} -> ${req.hostname}`);
      const canHaveBody = !(req.method === "GET" || req.method === "HEAD");
      const body = !canHaveBody
        ? undefined
        : req.body
        ? typeof req.body === "string"
          ? req.body
          : typeof req.body === "object"
          ? req.body instanceof Buffer
            ? req.body.toString("utf8")
            : JSON.stringify(req.body)
          : undefined
        : undefined;
      const headers = filterHeaders({
        ...req.headers,
        origin: req.headers.origin ? forwardURL : undefined,
        host: hostname,
        authority: req.headers.authority ? hostname : undefined,
        "x-forwarded-host": req.hostname,
        ...(addHeaders ?? {}),
        "content-length": body ? String(Buffer.byteLength(body)) : null,
        connection: "close",
      });
      const r = await fetch(url, {
        method: req.method,
        headers,
        body,
      });
      resp.status(r.status);
      r.headers.forEach((value, name) => {
        if (!excludeHeaders.includes(name)) {
          resp.set(name, value);
        }
      });
      r.body.on("end", () => {
        resp.end();
        debugLog(flags.debug, "finished proxy request", {
          status: r.status,
          duration: Date.now() - started,
          url,
        });
      });
      r.body.pipe(resp, { end: true });
    } catch (ex) {
      console.error("error handling proxy request", {
        method: req.method,
        url: req.url,
        hostname: req.hostname,
        error: ex,
      });
      resp.status(500).end("Internal Server Error");
    }
  };

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
    const apiURL = `https://${flags.site}.changelog.so`;
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
    app.get(
      "/api/analytics/:siteId",
      createForwarder(
        flags,
        apiURL,
        (req) => `/api/analytics/${req.params.siteId}`
      )
    );
    app.get(
      "/api/clap/count/:changelogId",
      createForwarder(
        flags,
        apiURL,
        (req) => `/api/clap/count/${req.params.changelogId}`
      )
    );
    app.post(
      "/api/clap",
      bodyParser.json(),
      createForwarder(flags, apiURL, () => `/api/clap`)
    );
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
