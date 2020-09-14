/**
 * Wechaty - WeChat Bot SDK for Personal Account, Powered by TypeScript, Docker, and 💖
 *  - https://github.com/chatie/wechaty
 */
const {
  Wechaty,
  ScanStatus,
  log,
  Contact,
} = require('wechaty')


const {
  PuppetPadplus
} = require('wechaty-puppet-padplus')

const {
  QrcodeTerminal
} = require('qrcode-terminal')

const DailyJob = require('./utils')

function onScan(qrcode, status) {
  if (status === ScanStatus.Waiting || status === ScanStatus.Timeout) {
    require('qrcode-terminal').generate(qrcode, {
      small: true
    }) // show qrcode on console

    const qrcodeImageUrl = [
      'https://api.qrserver.com/v1/create-qr-code/?data=',
      encodeURIComponent(qrcode),
    ].join('')

    log.info('StarterBot', 'onScan: %s(%s) - %s', ScanStatus[status], status, qrcodeImageUrl)

  } else {
    log.info('StarterBot', 'onScan: %s(%s)', ScanStatus[status], status)
  }
}

async function onLogin(user) {
  log.info('StarterBot', '%s login', user)
  Utils.initDailyJob(bot)
}

function onLogout(user) {
  log.info('StarterBot', '%s logout', user)
}

const token = 'PUT_YOUR_TOKEN_HERE'

const puppet = new PuppetPadplus({
  token,
})

const name = 'groupbot'

const bot = new Wechaty({
  puppet,
  name,
})


bot.on('scan', onScan)
bot.on('login', onLogin)
bot.on('logout', onLogout)

bot.start()
  .then(() => {
    log.info('StarterBot', 'Starter Bot Started.')
  })
  .catch(e => log.error('StarterBot', e))

