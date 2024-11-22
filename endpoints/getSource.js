const chalk = require("chalk");

const abortType = ['media', "preflight", "websocket", 'font', 'stylesheet']

function getSource({url, proxy, selector}) {
    return new Promise(async (resolve, reject) => {
        if (!url) return reject('Missing url parameter');

        console.log(chalk.blue(`Initializing browser context ${url}`));
        let context;
        try {
            context = await global.browser.createBrowserContext();
        } catch (e) {
            return reject(chalk.red(`Failed to create browser context ${url}`));
        }

        if (!context) return reject(chalk.red(`Failed to create browser context ${url}`));

        let isResolved = false;

        const {proxyRequest} = await import('puppeteer-proxy');

        const timeout = global.timeOut || 60000;
        const timeoutHandle = setTimeout(async () => {
            if (!isResolved) {
                console.log(chalk.yellow(`Request timeout reached, closing context ${url}`));
                await context.close();
                reject(chalk.red(`Timeout Error ${url}`));
            }
        }, timeout);

        try {
            console.log(chalk.green(`Creating new page ${url}`));
            const page = await context.newPage();
            await page.setRequestInterception(true);
            let isLogProxy = false;

            // Proxy interception logic with caching
            page.on('request', async (request) => {
                const requestType = request.resourceType(); // e.g., 'document', 'script', 'image'

                // Skip unnecessary resources
                if (abortType.includes(requestType)) {
                    return request.abort();
                }
                try {
                    if (proxy) {
                        await proxyRequest({
                            page,
                            proxyUrl: `http://${proxy.username ? `${proxy.username}:${proxy.password}@` : ""}${proxy.host}:${proxy.port}`,
                            request,
                        });
                    } else {
                        if (!isLogProxy) {
                            console.log(chalk.magenta(`Request not proxied, continuing ${url}`));
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
            await page.goto(url, {waitUntil: 'networkidle2', timeout});
            console.log(chalk.green(`Waiting for network to be idle ${url}`));
            await page.waitForNetworkIdle({idleTime: 1000, timeout}); // Adjust idleTime and timeout as needed
            if (selector) await page.waitForSelector(selector, {timeout});
            console.log(chalk.green(`Extracting page content ${url}`));
            const html = await page.content();
            console.log(chalk.green(`Closing browser context ${url}`));
            await context.close();
            isResolved = true;
            clearTimeout(timeoutHandle);
            resolve(html);

        } catch (e) {
            console.log(chalk.red(e.message, url));

            if (!isResolved) {
                console.log(chalk.red(`An error occurred, closing context ${url}`));
                await context.close();
                clearTimeout(timeoutHandle);
                reject(chalk.red(e.message, url));
            }
        }
    });
}

module.exports = getSource;
