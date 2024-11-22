const chalk = require('chalk');

function getSource({ url, proxy }) {
    return new Promise(async (resolve, reject) => {
        if (!url) return reject('Missing url parameter');

        console.log(chalk.blue('Initializing browser context...'));
        const context = await global.browser.createBrowserContext().catch(() => null);
        if (!context) return reject(chalk.red('Failed to create browser context'));

        let isResolved = false;

        const { proxyRequest } = await import('puppeteer-proxy');

        const timeout = global.timeOut || 60000;
        const timeoutHandle = setTimeout(async () => {
            if (!isResolved) {
                console.log(chalk.yellow('Request timeout reached, closing context...'));
                await context.close();
                reject(chalk.red('Timeout Error'));
            }
        }, timeout);

        let logOnce = false; // Track if we've logged the first request

        try {
            console.log(chalk.green('Creating new page...'));
            const page = await context.newPage();
            await page.setRequestInterception(true);

            // Proxy interception logic
            page.on('request', async (request) => {
                try {
                    const requestUrl = request.url();
                    const requestType = request.resourceType(); // e.g., 'document', 'script', 'image'
                    const requestMethod = request.method(); // e.g., 'GET', 'POST'
                    const requestHeaders = JSON.stringify(request.headers(), null, 2); // request headers

                    // Log request details
                    console.log(chalk.magenta(`Request intercepted: ${requestUrl}`));
                    console.log(chalk.magenta(`Type: ${requestType}`));
                    console.log(chalk.magenta(`Method: ${requestMethod}`));
                    console.log(chalk.magenta(`Headers: ${requestHeaders}`));

                    // Log only for the first time or if it's a non-image request
                    if (proxy && (requestType !== 'image' || !logOnce)) {
                        if (!logOnce) {
                            console.log(chalk.cyan('Proxying request...'));
                            logOnce = true;  // Log only once
                        }
                        await proxyRequest({
                            page,
                            proxyUrl: `http://${proxy.username ? `${proxy.username}:${proxy.password}@` : ""}${proxy.host}:${proxy.port}`,
                            request,
                        });
                    } else {
                        // Only log once for non-proxied requests
                        if (requestType !== 'image') {
                            console.log(chalk.cyan(`Request not proxied, continuing...`));
                        }
                        request.continue();
                    }
                } catch (e) {
                    console.log(chalk.red('Proxy request failed, aborting...'));
                    request.abort();
                }
            });

            console.log(chalk.green('Navigating to URL...'));
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            // await page.goto(url, { waitUntil: 'networkidle2' });
            // console.log(chalk.green('Waiting for network to be idle...'));
            // await page.waitForNetworkIdle({ idleTime: 1000, timeout: 30000 }); // Adjust idleTime and timeout as needed

            console.log(chalk.green('Extracting page content...'));
            const html = await page.content();
            console.log(chalk.green('Closing browser context...'));
            await context.close();
            isResolved = true;
            clearTimeout(timeoutHandle);
            resolve(html);

        } catch (e) {
            if (!isResolved) {
                console.log(chalk.red('An error occurred, closing context...'));
                await context.close();
                clearTimeout(timeoutHandle);
                reject(chalk.red(e.message));
            }
        }
    });
}

module.exports = getSource;
