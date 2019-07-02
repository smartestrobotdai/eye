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


function findIndexByTimestamp(results, timestamp) {
  for (let i=results.length-1; i>0; i--) {
    if (results[i].time === timestamp) {
      return i
    }
  }
  return null
}

async function fetchContent(browser, lastTimestamp) {
  let maxRetries = 10000
  let retries = 0

  while (retries < maxRetries) {
    const dateString = getDateString(new Date())
    const results = await browser.executeAsync(function(dateString, done) {
      let url = `https://www.nordnet.se/graph/instrument/11/101?from=${dateString}&to=${dateString}&fields=last,open,high,low,volume`
      fetch(url).then((resp) => resp.json()).then(done)
    }, dateString)

    const lastResult = results[results.length-1]

    if (lastResult.time !== lastTimestamp) {
      console.log(`new timestamp:${lastResult.time}, last timestamp:${lastTimestamp}`)
      let lastIndex = findIndexByTimestamp(results, lastTimestamp)
      console.log('lastIndex.' + lastIndex)
      let freshData = (retries > 0)
      return {results: results.slice(lastIndex+1), lastTimestamp:lastResult.time, freshData}
    }

    await snooze(100)
    retries += 1
  }

  return null, lastTimestamp
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
    logLevel: 'warn',
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


  let lastTimestamp = null
  while (true) {
    const curDate = new Date()
    const toFetch = shouldFetch(curDate)

    if (toFetch === false) {
      snooze(60000)
      continue
    }

    let obj = await fetchContent(browser, lastTimestamp)
    lastTimestamp = obj.lastTimestamp
    results = obj.results

    console.log('Got results:')
    console.log(results)
    console.log(obj.freshData)

    if (obj.freshData === true) {
      await snooze(55000)  
    } else {
      await snooze(1000)
    }
    
    results && await publish(nc, 'instument-101', JSON.stringify(results))
  }
  
  await browser.deleteSession()
})().catch((e) => console.error(e))

