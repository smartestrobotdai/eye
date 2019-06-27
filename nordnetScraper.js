const { remote } = require('webdriverio');

(async () => {
    const browser = await remote({
        logLevel: 'trace',
        capabilities: {
            browserName: 'chrome'
        }
    })

    await browser.url('https://www.nordnet.se/mux/web/nordnet/index.html')

    const inputElem = await browser.$('a.btn-primary')
    console.log(inputElem)
    await inputElem.click()
    const loginButton = await browser.$('button.button.link')
    console.log(loginButton)
    await loginButton.click()
    

    const username = await browser.$('#username')
    await username.setValue('magicinvest')

    const password = await browser.$('#password')
    await password.setValue('ken@Ericss0n')

    const login = await browser.$('button.button.primary.block')

    await login.click()

    await browser.pause(10000)
    console.log(await browser.getTitle()) // outputs: "Title is: WebdriverIO (Software) at DuckDuckGo"

    await browser.deleteSession()
})().catch((e) => console.error(e))

