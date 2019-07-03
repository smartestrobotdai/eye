async function nordnetLogin(browser) {
  await browser.url('https://www.nordnet.se/mux/web/nordnet/index.html')

  const inputElem = await browser.$('a.btn-primary')
  await inputElem.click()
  const loginButton = await browser.$('button.button.link')
  await loginButton.click()
  
  const username = await browser.$('#username')
  await username.setValue('magicinvest')

  const password = await browser.$('#password')
  await password.setValue('ken@Ericss0n')

  const login = await browser.$('button.button.primary.block')
  await login.click()

}


exports.nordnetLogin = nordnetLogin