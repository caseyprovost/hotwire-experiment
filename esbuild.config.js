#!/usr/bin/env node

// Esbuild is configured with 3 modes:
//
// `yarn build` - Build JavaScript and exit
// `yarn build --watch` - Rebuild JavaScript on change
// `yarn build --reload` - Reloads page when views, JavaScript, or stylesheets change
//
// Minify is enabled when "RAILS_ENV=production"
// Sourcemaps are enabled in non-production environments

const esbuild = require('esbuild')
const path = require('path')
const rails = require('esbuild-rails')
// const browserslist = require('browserslist');
// const browserslistToEsbuild = require('browserslist-to-esbuild');
const fs = require('fs')

// Generate readable browserslist for browserslist_useragent gem
// fs.writeFileSync('./browsers.json', JSON.stringify(browserslist()))

const clients = []
const entryPoints = [
  "application.js"
]
const watchDirectories = [
  "./app/javascript/**/*.js",
  "./app/components/**/*.js",
  "./app/views/**/*.html.erb"
]
const watch = process.argv.includes("--watch") && {
  onRebuild(error) {
    if (error) console.error("[watch] build failed", error);
    else console.log("[watch] build finished");
  },
};
const config = {
  absWorkingDir: path.join(process.cwd(), "app/javascript"),
  bundle: true,
  entryPoints: entryPoints,
  minify: process.env.RAILS_ENV == "production",
  outdir: path.join(process.cwd(), "app/assets/builds"),
  plugins: [
    rails()
  ],
  sourcemap: process.env.RAILS_ENV != "production",
  // target: browserslistToEsbuild(),
  watch: watch,
}

async function buildAndReload() {
  const chokidar = require('chokidar')
  const http = require('http')

  // Reload uses an HTTP server as an even stream to reload the browser
  http.createServer((req, res) => {
    return clients.push(
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
        Connection: "keep-alive",
      }),
    );
  }).listen(8082);

  let result = await esbuild.build({
    ...config,
    incremental: true,
    banner: {
      js: ' (() => new EventSource("http://localhost:8082").onmessage = () => location.reload())();',
    },
  })

  chokidar.watch(watchDirectories).on('all', (event, path) => {
    if (path.includes("javascript")) {
      result.rebuild()
    }
    clients.forEach((res) => res.write('data: update\n\n'))
    clients.length = 0
  });
}

if (process.argv.includes("--reload")) {
  buildAndReload()
} else {
  esbuild.build({
    ...config,
  }).catch(() => process.exit(1));
}
