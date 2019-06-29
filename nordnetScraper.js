const { remote } = require('webdriverio')
const moment = require('moment-timezone')

const snooze = ms => new Promise(resolve => setTimeout(resolve, ms));


function getDateString(date) {
  return `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`
}

const TIME_TYPE_CONTINUOUS_BID = 1

function shouldFetch(date) {
  const curDate = moment.tz('Europe/Stockholm')
  const hour = curDate.hour()
  const minute = curDate.minute()
  // continuous bid time
  if (inTimeRange(hour, minute, 8, 59, 17, 24)) {
    return true
  } else {
    return false
  }
}

function inTimeRange(curHour, curMinute, startHour, startMinute, endHour, endMinute) {
  if (curHour > startHour && curHour < endHour ) {
    return true
  } else if (curHour == startHour && curMinute >= startMinute) {
    return true
  } else if (curHour == endHour && curMinute <= endMinute) {
    return true
  }
  return false
}


function fetchContent() {
  let retries = 0
  while (retries < 3) {
    const dateString = getDateString(curDate)
    const result = browser.executeAsync(function(dateString, done) {
      let url = `https://www.nordnet.se/graph/instrument/11/101?from=${dateString}&to=${dateString}&fields=last,open,high,low,volume`
      fetch(url).then((resp) => resp.json()).then(allTicks => allTicks[allTicks.length-1]).then(done)
    }, dateString)

    console.log(result)
    if (result.time === expectedTimestamp) {
      break
    }
  }
}

(async () => {
  // get current time, active trade is between 9:00 to 17:29
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
  while (true) {
    const curDate = new Date()
    const toFetch = shouldFetch(curDate)
    const msLeft = 60000 - curDate.getTime() % 60000
    expectedTimestamp = curDate.getTime()+msLeft
    console.log(`next tick: ${expectedTimestamp}, toFetch: ${toFetch}`)
    await snooze(msLeft)

    if (toFetch) {
      fetchContent()
    }
  }
  
  await browser.deleteSession()
})().catch((e) => console.error(e))

