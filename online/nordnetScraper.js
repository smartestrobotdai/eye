const { remote } = require('webdriverio')
const moment = require('moment-timezone')
const NATS = require('nats');
const {nordnetLogin} = require('../util')

const snooze = ms => new Promise(resolve => setTimeout(resolve, ms));
const natsAddress = 'nats://localhost:4222'
const stock_ids = [3524, 160271]

function getDateString(date) {
  return `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`
}

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

async function fetchContent(browser, url, lastTimestamp) {
  let maxRetries = 10000
  let retries = 0

  while (retries < maxRetries) {
    const dateString = getDateString(new Date())
    const results = await browser.executeAsync(function(url, done) {
      fetch(url).then((resp) => resp.json()).then(done)
    }, url)

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

  await nordnetLogin(browser)
  await snooze(3000)


  let lastTimestampOmxs = null
  let lastTimestampStocks = []
  stock_ids.forEach(stock_id=>lastTimestampStocks.push(null))

  while (true) {
    const curDate = new Date()
    const toFetch = shouldFetch(curDate)

    if (toFetch === false) {
      await snooze(60000)
      continue
    }

    const dateString = getDateString(new Date())
    console.log('Starting to fetch OMXS30 indicator...')
    let url = getDataUrl(0, dateString, dateString)
    let obj = await fetchContent(browser, url, lastTimestamp)
    lastTimestamp = obj.lastTimestamp
    let results = obj.results
    let freshData = obj.freshData

    console.log('fetched new OMXS30 indicator results:')
    console.log(results)
    console.log(freshData)

    // write to DB
    let count = await insertRecords(0, results)
    console.log(`minute data for OMXS30 indicator finished, ${count} records were inserted`)

    // fetch stock data
    stock_ids.forEach(async function(stock_id, index) {
      console.log(`Starting to fetch stock_id: ${stock_id}...`)
      let url = getDataUrl(stock_id, dateString, dateString)
      let obj = await fetchContent(browser, url, lastTimestampStocks[index])
      lastTimestampStocks[index] = obj.lastTimestamp
      let results = obj.results

      // push to NATS
      results && await publish(nc, 'instument-{}'.format(stock_id), JSON.stringify(results))

      // write to DB
      let count = await insertRecords(stock_id, results)
      console.log(`minute data for stock_id: ${stock_id} finished, ${count} records were inserted`)
    })

    if (freshData === true) {
      await snooze(55000)
    } else {
      await snooze(1000)
    }
  }
  await browser.deleteSession()
})().catch((e) => console.error(e))

