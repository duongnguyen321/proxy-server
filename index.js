const express = require('express')
const app = express()
const port = process.env.PORT || 3000
const pathParam = process.env.PATH_PARAM || '/'
const bodyParser = require('body-parser')
const authToken = process.env.AUTH_TOKEN || null
const cors = require('cors')
const reqValidate = require('./module/reqValidate')

global.browserLength = 0
global.browserLimit = Number(process.env.BROWSER_LIMIT) || 20
global.timeOut = Number(process.env.TIME_OUT || 60000)
global.cache = new Map();

app.use(bodyParser.json({}))
app.use(bodyParser.urlencoded({extended: true}))
app.use(cors())
let server = app.listen(port, () => {
    console.log(`Server running on port ${port}`)
})
try {
    server.timeout = global.timeOut
} catch (e) {
    console.error(e.message)
}
if (process.env.SKIP_LAUNCH !== 'true') require('./module/createBrowser')

const getSource = require('./endpoints/getSource')
const solveTurnstileMin = require('./endpoints/solveTurnstile.min')
const solveTurnstileMax = require('./endpoints/solveTurnstile.max')
const wafSession = require('./endpoints/wafSession')
const chalk = require("chalk");

app.post(pathParam, async (req, res) => {
    try {
        const data = req.body
        console.log('data: ', data)

        const check = reqValidate(data)

        if (check !== true) return res.status(400).json({code: 400, message: 'Bad Request', schema: check})

        if (authToken && data.authToken !== authToken) return res.status(401).json({code: 401, message: 'Unauthorized'})

        if (global.browserLength >= global.browserLimit) return res.status(429).json({
            code: 429,
            message: 'Too Many Requests'
        })

        if (process.env.SKIP_LAUNCH !== 'true' && !global.browser) return res.status(500).json({
            code: 500,
            message: 'The scanner is not ready yet. Please try again a little later.'
        })

        let result = {code: 500};

        global.browserLength++

        switch (data.mode) {
            case "source": {
                console.info(chalk.green(`Call ${data.url} by mode ${data.mode}`))
                result = await getSource(data).then(res => {
                    return {source: res, code: 200}
                }).catch(err => {
                    return {code: 500, message: err.message}
                })
                break;
            }
            case "turnstile-min": {
                console.info(chalk.green(`Call ${data.url} by mode ${data.mode}`))
                result = await solveTurnstileMin(data).then(res => {
                    return {token: res, code: 200}
                }).catch(err => {
                    return {code: 500, message: err.message}
                })
                break;
            }
            case "turnstile-max": {
                console.info(chalk.green(`Call ${data.url} by mode ${data.mode}`))
                result = await solveTurnstileMax(data).then(res => {
                    return {token: res, code: 200}
                }).catch(err => {
                    return {code: 500, message: err.message}
                })
                break;
            }
            case "waf-session": {
                console.info(chalk.green(`Call ${data.url} by mode ${data.mode}`))
                result = await wafSession(data).then(res => {
                    return {...res, code: 200}
                }).catch(err => {
                    return {code: 500, message: err.message}
                })
                break;
            }
        }

        global.browserLength--

        res.status(result.code ?? 500).send(result)
    } catch (e) {
        console.error(chalk.red(e.message))
    }
})

app.use((req, res) => {
    console.log('req: ', req.path)
    console.log('req: ', req.body)
    console.log('req: ', req.method)
    console.log('pathParam: ', pathParam)
    res.status(404).json({code: 404, message: 'Not Found'})
})

module.exports = app
