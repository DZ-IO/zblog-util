const editor = require("editor");
const moment = require("moment");
const { join } = require("path");
const { existsSync, mkdirSync } = require("fs");

if (!existsSync("article")) {
  mkdirSync("article");
}
if (!existsSync("dist/images")) {
  mkdirSync("dist/images");
}

editor(join("article", `${moment().format("YYYY-MM-DD_HH-MM-SS")}.md`));
