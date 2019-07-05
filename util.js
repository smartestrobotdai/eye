const https = require('https');

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



function getDateString(date) {
  return `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`
}

async function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, resp => {
      let data = ''
      // A chunk of data has been recieved.
      resp.on('data', (chunk) => {
        data += chunk;
      })
      // The whole response has been received. Print out the result.
      resp.on('end', () => {
        try {
          let daily = JSON.parse(data)    
          resolve(daily)
        } catch(e) {
          console.log(`parse data failed: ${e}, ${url}:${data}`)
          resolve(null)
        }
      })
    }).on("error", (err) => {
      console.log("Error: " + err.message + " " + data);
      reject()
    })
  })
}

function getCompletedRecord(record) {
  let {time, open, high, low, last, volume} = record

  open=open?open:0
  high=high?high:0
  low=low?low:0
  last=last?last:0
  volume=volume?volume:0

  return {time, open, high, low, last, volume}
}

function getDataUrl(stockId, from, to) {
  url = ''
  if (stockId === '0') {
    url = `https://www.nordnet.se/graph/indicator/SSE/OMXSPI?from=${from}&to=${to}&fields=last,open,high,low`
  } else {
    url = `https://www.nordnet.se/graph/instrument/11/${stockId}?from=${from}&to=${to}&fields=last,open,high,low,volume`
  }
  return url
}

async function executeQuery(client, sql) {
  return new Promise(resolve => {
    client.query(sql, (err, res) => {
      if (err) {
        console.log(`executing ${sql} failed: ${err}`)
        throw new Error(err)
      }
      resolve(res)
    })
  })
}

async function executingWrite(client, sql, value) {
  return new Promise(resolve => {
    client.query(sql, value, (err, res) => {
      if (err) {
        console.log(`executing ${sql}, ${value} failed, err: ${err}`)
        throw new Error(err)
      } 
      resolve(res)   
    })
  })
}


async function insertRecords(client, stockId, records) {
  let count = 0
  records.forEach(async function(record) {
    let {time, open, high, low, last, volume} = getCompletedRecord(record)
    let text = 'INSERT INTO minute(stock_id, time_stamp, open, high, low, last, volume) VALUES($1,to_timestamp($2),$3,$4,$5,$6,$7) \
         ON CONFLICT DO NOTHING'
    let value = [stockId, time/1000, open, high, low, last, Math.trunc(volume)]
    let res = await executingWrite(client, text, value)
    if (res.rowCount) {
      count += 1
    }
  })
  console.log(`${count} records have been inserted`)
  return count
}

function calEMA(oldVal, newVal, days) {
  let multiplier = 2 / (days + 1)
  return (newVal - oldVal) * multiplier + oldVal
}

exports.isWorkingDay = (ts) => {
  if (ts === null) {
    d = new Date()
  } else {
    d = new Date(ts)
  }

  let day = d.getDay()
  return day !== 6 && day !== 0
}

exports.nordnetLogin = nordnetLogin
exports.fetch = fetch
exports.executingWrite = executingWrite
exports.executeQuery = executeQuery
exports.getDateString = getDateString
exports.getDataUrl = getDataUrl
exports.getCompletedRecord = getCompletedRecord
exports.insertRecords = insertRecords
