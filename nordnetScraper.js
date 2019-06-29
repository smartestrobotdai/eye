const { remote } = require('webdriverio')
const moment = require('moment-timezone')
const NATS = require('nats');



const snooze = ms => new Promise(resolve => setTimeout(resolve, ms));
const natsAddress = 'nats://localhost:4222'

function getDateString(date) {
  return `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`
}

const TIME_TYPE_CONTINUOUS_BID = 1

function shouldFetch(date) {
  const curDate = moment.tz('Europe/Stockholm')
  const hour = curDate.hour()
  const minute = curDate.minute()
  const weekday = curDate.weekday()
  if (weekday < 1 || weekday > 5) {
    return false
  }
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


async function fetchContent(browser, curDate) {
  let retries = 0
  while (retries < 3) {
    const dateString = getDateString(curDate)
    const result = await browser.executeAsync(function(dateString, done) {
      let url = `https://www.nordnet.se/graph/instrument/11/101?from=${dateString}&to=${dateString}&fields=last,open,high,low,volume`
      fetch(url).then((resp) => resp.json()).then(allTicks => allTicks[allTicks.length-1]).then(done)
    }, dateString)

    console.log(result)
    if (result.time === expectedTimestamp) {
      console.log(`got data with timestamp:${result.time} successfully`)
      return result
    } else {
      console.log(`expected: ${expectedTimestamp}, actual: ${result.time}`)

    }
    retries += 1
  }

  return null
}

function publish(nc, subject, msg) {
  return new Promise(resolve => {
    nc.publish(subject, msg, function() {
        console.log('Published [' + subject + '] : "' + msg + '"');
        resolve()
    });

  })

}

(async () => {
  console.log(`Connecting to NATS: ${natsAddress}`)
  const nc = NATS.connect({url: natsAddress})

  nc.on('error', function(e) {
      console.log('Error [' + nc.currentServer + ']: ' + e);
      process.exit();
  })

  // await publish(nc, '101', 'mytest')

  // get current time, active trade is between 9:00 to 17:29
  const browser = await remote({
    logLevel: 'trace',
    capabilities: {
      browserName: 'chrome'
    }
  })

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
  while (true) {
    const curDate = new Date()
    const toFetch = shouldFetch(curDate)
    const msLeft = 60000 - curDate.getTime() % 60000
    expectedTimestamp = curDate.getTime()+msLeft
    console.log(`next tick: ${expectedTimestamp}, toFetch: ${toFetch}`)
    await snooze(msLeft)

    if (toFetch) {
      result = await fetchContent(browser, curDate)
      result && await publish(nc, '101', JSON.stringify(result))
    }
  }
  
  await browser.deleteSession()
})().catch((e) => console.error(e))

