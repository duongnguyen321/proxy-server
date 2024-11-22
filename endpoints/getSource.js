function getSource({ url, proxy }) {
    return new Promise(async (resolve, reject) => {
        if (!url) return reject('Missing url parameter');

        const context = await global.browser.createBrowserContext().catch(() => null);
        if (!context) return reject('Failed to create browser context');

        let isResolved = false;

        const { proxyRequest } = await import('puppeteer-proxy');

        const timeout = global.timeOut || 60000;
        const timeoutHandle = setTimeout(async () => {
            if (!isResolved) {
                await context.close();
                reject("Timeout Error");
            }
        }, timeout);

        try {
            const page = await context.newPage();
            await page.setRequestInterception(true);

            // Proxy interception logic
            page.on('request', async (request) => {
                try {
                    if (proxy) {
                        await proxyRequest({
                            page,
                            proxyUrl: `http://${proxy.username ? `${proxy.username}:${proxy.password}@` : ""}${proxy.host}:${proxy.port}`,
                            request,
                        });
                    } else {
                        request.continue();
                    }
                } catch (e) {
                    request.abort();
                }
            });

            // Handle navigation and waiting for network idle
            await page.goto(url, { waitUntil: 'networkidle2' });
            await page.waitForNetworkIdle({ idleTime: 1000, timeout: 30000 }); // Adjust idleTime and timeout as needed

            const html = await page.content();
            await context.close();
            isResolved = true;
            clearTimeout(timeoutHandle);
            resolve(html);

        } catch (e) {
            if (!isResolved) {
                await context.close();
                clearTimeout(timeoutHandle);
                reject(e.message);
            }
        }
    });
}
module.exports = getSource;
