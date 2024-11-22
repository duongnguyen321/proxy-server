const chalk = require("chalk");

function getSource({url, proxy}) {
    return new Promise(async (resolve, reject) => {
        if (!url) return reject('Missing url parameter');

        console.log(chalk.blue('Initializing browser context...'));
        const context = await global.browser.createBrowserContext().catch(() => null);
        if (!context) return reject(chalk.red('Failed to create browser context'));

        let isResolved = false;

        const {proxyRequest} = await import('puppeteer-proxy');

        const timeout = global.timeOut || 60000;
        const timeoutHandle = setTimeout(async () => {
            if (!isResolved) {
                console.log(chalk.yellow('Request timeout reached, closing context...'));
                await context.close();
                reject(chalk.red('Timeout Error'));
            }
        }, timeout);

        try {
            console.log(chalk.green('Creating new page...'));
            const page = await context.newPage();
            await page.setRequestInterception(true);
            let isLogProxy = false
            // Proxy interception logic
            page.on('request', async (request) => {
                const requestType = request.resourceType(); // e.g., 'document', 'script', 'image'

                // Skip unnecessary resources like images, stylesheets, fonts, etc.
                if (['stylesheet', 'font', 'media'].includes(requestType)) {
                    console.log(chalk.yellow(`Skipping request: ${request.url()}`));
                    request.abort(); // Abort these requests to save time
                    return; // Skip logging and proxying unnecessary requests
                }

                try {
                    console.log(chalk.blue("Calling: ", chalk.underline(request.url())));
                    if (proxy) {
                        await proxyRequest({
                            page,
                            proxyUrl: `http://${proxy.username ? `${proxy.username}:${proxy.password}@` : ""}${proxy.host}:${proxy.port}`,
                            request,
                        });
                    } else {
                        if (!isLogProxy) {
                            console.log(chalk.red('Request not proxied, continuing...'));
                            isLogProxy = true
                        }
                        request.continue();
                    }
                } catch (e) {
                    console.log(chalk.red('Proxy request failed, aborting...'));
                    console.log(chalk.red(e.message))

                    request.abort();
                }
            });

            console.log(chalk.green('Navigating to URL...'));
            await page.goto(url, {waitUntil: 'networkidle2', timeout});
            console.log(chalk.green('Waiting for network to be idle...'));
            await page.waitForNetworkIdle({idleTime: 5000, timeout}); // Adjust idleTime and timeout as needed

            console.log(chalk.green('Extracting page content...'));
            const html = await page.content();
            console.log(chalk.green('Closing browser context...'));
            await context.close();
            isResolved = true;
            clearTimeout(timeoutHandle);
            resolve(html);

        } catch (e) {
            console.log(chalk.red(e.message))

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
