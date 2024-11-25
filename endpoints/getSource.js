const chalk = require("chalk");

// const abortType = ["media", "preflight", "websocket", "font", "stylesheet"];
const abortType = ["media", "preflight", "websocket", "font", "stylesheet"];

function getSource({ url, proxy, selector, waitFn }) {
  return new Promise(async (resolve, reject) => {
    if (!url) return reject("Missing url parameter");

    console.log(chalk.blue(`Initializing browser context ${url}`));
    let context;
    try {
      context = await global.browser.createBrowserContext();
    } catch (e) {
      return reject(chalk.red(`Failed to create browser context ${url}`));
    }

    if (!context)
      return reject(chalk.red(`Failed to create browser context ${url}`));

    let isResolved = false;

    const { proxyRequest } = await import("puppeteer-proxy");

    const timeout = global.timeOut || 60000;
    // const timeoutHandle = setTimeout(async () => {
    //   if (!isResolved) {
    //     console.log(
    //       chalk.yellow(`Request timeout reached, closing context ${url}`)
    //     );
    //     await context.close();
    //     reject(chalk.red(`Timeout Error ${url}`));
    //   }
    // }, timeout);

    try {
      console.log(chalk.green(`Creating new page ${url}`));
      const page = await context.newPage();
      await page.setRequestInterception(true);
      let isLogProxy = false;

      // Proxy interception logic with caching
      page.on("request", async (request) => {
        const requestType = request.resourceType(); // e.g., 'document', 'script', 'image'
        const request = response.request();
        const url = request.url();

        console.info(
          chalk.blue(requestType),
          " ",
          chalk.blue(request.method()),
          " ",
          chalk.gray(request.url())
        );
        // Skip unnecessary resources
        if (abortType.includes(requestType)) {
          console.warn(
            "ABORTING... ",
            chalk.yellow(requestType),
            " ",
            chalk.yellow(request.method()),
            " ",
            chalk.yellow(request.url())
          );
          return request.abort();
        }
        try {
          console.log(
            "ACCEPT... ",
            chalk.green(requestType),
            " ",
            chalk.green(request.method()),
            " ",
            chalk.green(request.url())
          );

          // Log only XHR or Fetch requests
          if (requestType === "xhr" || requestType === "fetch") {
            console.log(chalk.green("Captured Data Request:"), chalk.blue(url));

            // Optionally, get the response body if needed
            try {
              const body = await response.text();
              console.log(chalk.yellow("Response Body:"), body);
            } catch (err) {
              console.log(
                chalk.red("Error reading response body"),
                err.message
              );
            }
          }

          if (proxy) {
            await proxyRequest({
              page,
              proxyUrl: `http://${
                proxy.username ? `${proxy.username}:${proxy.password}@` : ""
              }${proxy.host}:${proxy.port}`,
              request,
            });
          } else {
            if (!isLogProxy) {
              console.log(
                chalk.magenta(`Request not proxied, continuing ${url}`)
              );
              isLogProxy = true;
            }
            request.continue();
          }
        } catch (e) {
          console.log(chalk.red(`Proxy request failed, aborting ${url}`));
          console.log(chalk.red(e.message, url));
          request.abort();
        }
      });

      console.log(chalk.green(`Navigating to URL ${url}`));
      await page.goto(url, { waitUntil: "networkidle2", timeout });
      console.log(chalk.green(`Waiting for network to be idle ${url}`));
      await page.waitForNetworkIdle({ idleTime: 1000, timeout }); // Adjust idleTime and timeout as needed
      if (selector) {
        console.log(chalk.green(`Waiting for element ${selector} ${url}`));
        await page.waitForSelector(selector, { timeout });
      }
      if (waitFn) {
        console.log(chalk.green(`Waiting for function ${waitFn} ${url}`));
        await page.waitForFunction(waitFn, { timeout });
      }
      console.log(chalk.green(`Extracting page content ${url}`));
      const html = await page.content();
      console.log(chalk.green(`Closing browser context ${url}`));
      await context.close();
      isResolved = true;
      // clearTimeout(timeoutHandle);
      resolve(html);
    } catch (e) {
      console.log(chalk.red(e.message, url));

      if (!isResolved) {
        console.log(chalk.red(`An error occurred, closing context ${url}`));
        await context.close();
        // clearTimeout(timeoutHandle);
        reject(chalk.red(e.message, url));
      }
    }
  });
}

module.exports = getSource;
