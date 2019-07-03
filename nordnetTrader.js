const {nordnetLogin} = require('util')

async function fetchAccountInfo(browser) {
	retries = 0
	maxRetries = 3
	while (retries < maxRetries) {
    const results = await browser.executeAsync(function(done) {
      let url = `https://www.nordnet.se/mux/web/depa/mindepa/transaktionerNotor.html`
      fetch(url).then((resp) => resp.text()).then(done)

    console.log(results)
    

    })
}


(async () => {
  console.log(`Connecting to NATS: ${natsAddress}`)
  const nc = NATS.connect({url: natsAddress})

  nc.on('error', function(e) {
      console.log('Error [' + nc.currentServer + ']: ' + e);
      process.exit();
  })

  // get current time, active trade is between 9:00 to 17:29
  const browser = await remote({
    logLevel: 'warn',
    capabilities: {
      browserName: 'chrome'
    }
  })

  await nordnetLogin(browser)

  // get balance from https://www.nordnet.se/mux/web/depa/mindepa/transaktionerNotor.html


  
  await browser.deleteSession()
})().catch((e) => console.error(e))