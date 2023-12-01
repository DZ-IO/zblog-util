const { readdir, readFile, writeFile } = require("fs/promises");
const { statSync, existsSync, mkdirSync } = require("fs");
const { join } = require("path");
const showdown = require("showdown");
const RSS = require("rss");
const { Eta } = require("eta");
const moment = require("moment");

if (!existsSync("dist/article")) {
  mkdirSync("dist/article");
}

if (!existsSync("templates")) {
  console.error("未找到模板，请确保模板已经正确安装");
  process.exit(1);
}

if (!existsSync("article")) {
  console.error("未找到文章，生成前请确保你已经写好了文章");
  process.exit(1);
}

const showdownConverter = new showdown.Converter();
const eta = new Eta({ views: join("templates") });

readFile(process.env.npm_package_json)
  .then((val) => {
    // 加载死配置
    let config = JSON.parse(val);
    config = {
      ...config,
      generator: `ZBlog V${config.version}`,
      feed_url: "/rss.xml",
      pubDate: new Date(),
    };
    // 加载可选配置
    if (config.webMaster) {
      config = {
        managingEditor: config.webMaster,
        copyright: `${new Date().getFullYear()} ${config.webMaster}`,
        ...config,
      };
    }
    let feed = new RSS(config);
    let homepage = { siteConfig: config, articles: [] };
    readdir("article")
      .then((val) => {
        let tasks = [];
        val.forEach((file) => {
          let filename = file.split(".md")[0];
          tasks.push(
            readFile(join("article", file))
              // 预处理
              .then((article) => {
                article = article.toString().replace(".md",".html");
                return new Promise((resolve, reject) => {
                  if (article.slice(0, 2) !== "# ") {
                    reject();
                  }
                  let cutedArticle = `${article
                    .split("\n")
                    .slice(1, config.showLineNum)
                    .join("\n")}\n\n[查看全文](/article/${filename}.html)`;
                  let feedItem = {
                    title: article.split("\n")[0].slice(2),
                    description: showdownConverter.makeHtml(cutedArticle),
                    article: showdownConverter.makeHtml(article),
                    url: `/article/${filename}.html`,
                    categories: [],
                    author: config.webMaster,
                  };
                  switch (config.time) {
                    case "ftime":
                      let date = filename.split("_");
                      date[1] = date[1].replace(/-/g, ":");
                      feedItem.date = new Date(date.join("T"));
                      break;
                    default:
                      feedItem.date = statSync(`article/${file}`)[config.time];
                      break;
                  }
                  resolve(feedItem);
                });
              })
              // 加入RSS
              .then((feedItem) => {
                return new Promise((resolve, reject) => {
                  console.log(`Building article ${feedItem.title}`);
                  feed.item({
                    ...feedItem,
                  });
                  resolve(feedItem);
                });
              })
              // 加入index.html
              .then(
                (feedItem) =>
                  new Promise((resolve, reject) => {
                    homepage.articles.push({
                      ...feedItem,
                      date: moment(feedItem.date).format("YYYY-MM-DD_HH-MM-SS"),
                    });
                    resolve(feedItem);
                  })
              )
              // MD转换HTML
              .then((item) =>
                eta.renderAsync("article", {
                  ...item,
                  siteConfig: config,
                })
              )
              .then((html) =>
                writeFile(join("dist", "article", `${filename}.html`), html)
              )
          );
        });
        return Promise.all(tasks);
      })
      .then(() => {
        console.log(`Building feed file...`);
        return writeFile(`dist${config["feed_url"]}`, feed.xml());
      })
      .then(() => {
        console.log("Building index.html");
        homepage.articles.reverse();
        return eta.renderAsync("index", homepage);
      })
      .then((html) => writeFile(join("dist", "index.html"), html))
      .then(() => console.log("ok"))
      .catch((err) => {
        throw err;
      });
  })
  .catch((err) => {
    throw err;
  });
