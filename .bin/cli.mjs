#!/usr/bin/env node

import meow from "meow";
import build from "../src/js/build.mjs";
import dev from "../src/js/dev.mjs";
import pkg from "../src/js/package.mjs";
import create from "../src/js/create.mjs";

const helpTemplate = (command = "", help, examples = "") => {
  return `Usage:

  $ changelog ${command}

${help}

General Options:

  --help                      This menu, :/
  --version                   Print the version

${examples}
`;
};

const cli = meow(
  helpTemplate(
    "",
    `
Commands

  build             Build a changelog
  dev               Run the development server
  package           Build a package for uploading
  create            Create a new theme
`,
    `
Examples

  $ changelog build
  $ changelog dev
`
  ),
  {
    importMeta: import.meta,
    flags: {},
  }
);

if (cli.input.length === 0) {
  cli.showHelp();
}

let command = null;

switch (cli.input[0]) {
  case "build": {
    command = build;
    break;
  }
  case "dev": {
    command = dev;
    break;
  }
  case "package": {
    command = pkg;
    break;
  }
  case "create": {
    command = create;
    break;
  }
  default: {
    console.error("🛑 invalid command");
    cli.showHelp();
    break;
  }
}

const makeOptions = (command) => {
  return Object.keys(command.flags)
    .filter((key) => !command.flags[key].hidden)
    .map((key) => {
      const flag = command.flags[key];
      const def = `${flag.default ? `[default=${flag.default}]` : ""}`;
      const prefix = flag.alias ? `-${flag.alias}, ` : "";
      const fullflag = flag.type === "boolean" ? `--[no-]${key}` : `--${key}`;
      const _flag = prefix + fullflag;
      return `  ${_flag.padEnd(25)} ${flag.description} ${def}`;
    })
    .join("\n");
};

const help = `${command.description}

Options:

${makeOptions(command)}
`;

const res = meow(helpTemplate(cli.input[0], help), {
  importMeta: import.meta,
  flags: command.flags,
  argv: process.argv.slice(3),
});

command.run(res.input, res.flags);
