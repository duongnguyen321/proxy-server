const chalk = require("chalk");

function getSource({ url, proxy }) {
    return new Promise(async (resolve, reject) => {
        if (!url) {
            console.log(chalk.red('Missing url parameter'));
            return reject('Missing url parameter');
        }

        console.log(chalk.blue('Initializing browser context...'));
        const context = await global.browser.createBrowserContext().catch(() => null);
        if (!context) {
            console.log(chalk.red('Failed to create browser context'));
            return reject('Failed to create browser context');
        }

        let isResolved = false;

        const { proxyRequest } = await import('puppeteer-proxy');

        const timeout = global.timeOut || 60000;
        const timeoutHandle = setTimeout(async () => {
            if (!isResolved) {
                console.log(chalk.yellow('Timeout reached, closing context...'));
                await context.close();
                reject("Timeout Error");
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
                if (['image', 'stylesheet', 'font', 'media', 'other'].includes(requestType)) {
                    console.log(chalk.yellow(`Skipping request: ${request.url()}`));
                    request.abort(); // Abort these requests to save time
                    return; // Skip logging and proxying unnecessary requests
                }

                try {
                    console.log(chalk.magenta(`Request intercepted: ${request.url()}`));
                    if (proxy) {
                        console.log(chalk.cyan('Proxying request...'));
                        await proxyRequest({
                            page,
                            proxyUrl: `http://${proxy.username ? `${proxy.username}:${proxy.password}@` : ""}${proxy.host}:${proxy.port}`,
                            request,
                        });
                    } else {
                        console.log(chalk.green('Request not proxied, continuing...'));
                        request.continue();
                    }
                } catch (e) {
                    console.log(chalk.red('Error with proxy request, aborting...'));
                    request.abort();
                }
            });

            // Handle navigation and waiting for network idle
            console.log(chalk.green('Navigating to URL...'));
            await page.goto(url, { waitUntil: 'networkidle2' });
            console.log(chalk.green('Waiting for network to be idle...'));
            await page.waitForNetworkIdle({ idleTime: 1000, timeout: 30000 });

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
