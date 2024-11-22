const chalk = require('chalk');

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

            // Proxy interception logic
            page.on('request', async (request) => {
                const requestType = request.resourceType(); // e.g., 'document', 'script', 'image'

                // Skip unnecessary resources like images, stylesheets, fonts, etc.
                if (['image', 'stylesheet', 'font', 'media'].includes(requestType)) {
                    request.abort(); // Abort these requests to save time
                    return; // Skip logging and proxying unnecessary requests
                }

                // Log and proxy only essential requests (e.g., documents, AJAX, scripts)
                if (proxy) {
                    console.log(chalk.magenta(`Request intercepted: ${request.url()}`));
                    // console.log(chalk.magenta(`Type: ${requestType}`));
                    // console.log(chalk.magenta(`Method: ${request.method()}`));
                    try {
                        await proxyRequest({
                            page,
                            proxyUrl: `http://${proxy.username ? `${proxy.username}:${proxy.password}@` : ""}${proxy.host}:${proxy.port}`,
                            request,
                        });
                    } catch (e) {
                        console.log(chalk.red('Proxy request failed, aborting...'));
                        request.abort();
                    }
                } else {
                    // If it's not an essential request, just continue without logging
                    request.continue();
                }
            });

            console.log(chalk.green('Navigating to URL...'));
            await page.goto(url, {waitUntil: 'networkidle2'}); // Wait for the page to fully load

            // Wait for any loading overlay to disappear (indicating page content is ready)

            console.log(chalk.green('Waiting for network to be idle...'));
            await page.waitForNetworkIdle({idleTime: 1000, timeout: 30000}); // Wait for all network activity to settle

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
