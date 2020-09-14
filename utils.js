const {
    log,
    MiniProgram,
    Wechaty,
} = require('wechaty')

const jsqr = require('jsqr')
const fs = require('fs-extra')
const Jimp = require('jimp')
const convertor = require('zh_cn_zh_tw')
const Consts = require('./consts')
const Monitoring = require('./monitoring')
const Database = require('./database')
const axios = require('axios').default;
const Canvas = require('./canvas')

const {
    PuppetPadplus
} = require('wechaty-puppet-padplus')

function getPadBot(token, name) {
    const puppet = new PuppetPadplus({
        token,
    })
    return new Wechaty({
        puppet,
        name, // generate xxxx.memory-card.json and save login data for the next login
    })
}

function isSeriousAdsText(text) {
    if (text == null || text == undefined) {
        log,
        info("text is null or undefined")
        return false
    }
    const regex_list = [/申请美国高中/, /招聘群/, /辍学/, /挂科/, /学历认证/, /病假条/, /转账充值/, /使馆认证/,
        /成绩单/, /生病证明/, /礼品卡/, /亚马逊学生会员/, /专业代笔/, /Essay.*代笔/, /essay.*代写/, /全球代叫车/, /美国代订餐/,
        /提现秒到/, /推荐一个抖音直播/, /全职兼职刷单/, /需要您的帮助和支持/, /招在家工作/, /有没有兼职的/, /接单中/, /uber代叫/, /lyft代叫/,
        /手机都能做/, /想学的我这里都有/, /免费公开课/, /开发票/, /求职一站式服务/, /赶紧扫码加入/, /诚聘接单员/, /长期招聘/, /想做兼职/, /一单一结/,
        /本佣立返/, /千万玩家在线/, /托管都能赢/, /网课也可以保A/, /专业国际物流/, /实体经营/, /免费领取一个平衡车/, /影子全球转运/,
        /留学生华人回国机票/, /不能正常毕业/, /招海外代理/, /国际货运服务热线/, /互换质量群/, /咨询机票相关/, /搜公众号/,
        /机票预订和咨询/, /免费论文检测/, /代写团队/, /各科写手/, /便宜好票加我私聊/, /硬核Essay/, /论文专家/, /换美国群/,
        /换群请加我备注/, /客户群体遍及全球/, /公开课不收费/, /学不学都建议加下/, /代写essay/, /推荐一位代写/, /良心代写/, /专业网课辅修/,
        /秋招季最强福利/, /扫码.*领取/, /免费提供中文海外版/, /招聘兼职/, /一任务一结算/, /返还本金和佣金/, /网络公司[^]*spectrum/,
        /招聘.*二手.*出租/, /折.*代购/, /折.*代订/, /推荐.*拼邮/, /微商引流/, /吉他学习群/, /amazon.*折购物/, /专业代写/, /线上水果店/,
        /写手团队/, /网课代修/, /大量换.*国/, /邮寄.*备用/, /爱烟网/
    ]
    for (regex of regex_list) {
        if (regex.test(text)) {
            return true
        }
    }
    return false
}

function isLightAdsText(text) {
    const words = ["meiqian.online", "防疫物资", "专业资深保险", "保险免费估价"]
    for (word of words) {
        if (text.includes(word)) {
            return true
        }
    }
    return false
}


// returns the ads status in the message
async function detectAds(msg, bot) {
    let type = msg.type()
    let text = msg.text_sc
    // always check serious ads text first no matter what the message type is
    if (isSeriousAdsText(text)) {
        return Consts.AdsType.BANNED_TEXT
    }

    if (type == bot.Message.Type.Image) {
        let fileBox = await msg.toFileBox()
        let res = await isGroupQRCode(await fileBox.toBuffer())
        if (res) {
            return Consts.AdsType.GROUP_QRCODE
        }
    }
    if (type == bot.Message.Type.Contact) {
        let invalidNames = ["留学顾问", "硬核学术顾问", "小助", "留学服务", "深美速达", "物流"]
        for (invalidName of invalidNames) {
            if (text.includes(invalidName)) {
                return Consts.AdsType.BANNED_CONTACT_CARD
            }
        }
    }
    if (type == bot.Message.Type.MiniProgram) {
        let mp = await msg.toMiniProgram()
        let appid = mp.appid()
        log.info("app id: ", appid)
        if (appid != "" && appid != null && appid !== Consts.bmzfAppId) {
            return Consts.AdsType.MINI_PROGRAM
        }
    }
    if (type == bot.Message.Type.Url) {
        let link = await msg.toUrlLink()
        let url = link.url()
        log.info(url)
        // whitelist google docs
        let urlWhitelist = ["https://docs.google.com"]
        for (whiteUrl of urlWhitelist) {
            if (url.includes(urlWhitelist)) {
                return Consts.AdsType.NONE
            }
        }
        if (url.includes(Consts.bmzfUrlKeyword) == false) {
            return Consts.AdsType.EXTERNAL_HEAVY_URL
        }
    }
    let lightUrls = ["bay123.com", "craigslist.org"]
    for (url of lightUrls) {
        if (text.includes(url)) {
            return Consts.AdsType.EXTERNAL_LIGHT_URL
        }
    }
    if (isLightAdsText(text)) {
        return Consts.AdsType.SUSPICIOUS_TEXT
    }
    return Consts.AdsType.NONE
}

function getBotName() {
    var argv = require('minimist')(process.argv.slice(2))
    return argv['puppet']
}

async function findRooms(bot) {
    const rooms = await bot.Room.findAll()
    for (let i = 0; i < rooms.length; i++) {
        let room = rooms[i]
        let topic = await room.topic()
        log.info(room.id, topic)
    }
}

function getRentRoomsByKey(room_key) {
    let result = []
    for (room of Consts.getRentRooms(Consts.ENV)) {
        if (room.room_key == room_key) {
            result.push(room)
        }
    }
    return result
}

function formatMsg(msg, bot) {
    if (msg.type() == bot.Message.Type.Text) {
        // convert to simplified chinese
        let text = toSimplifiedChinese(msg.text())
        msg.text_sc = text.toLowerCase()
    } else {
        msg.text_sc = msg.text()
    }
    return msg
}

module.exports = {
    findRooms,
    getRentRoomsByKey,
    formatMsg,
    isSeriousAdsText,
    detectAds,
    getBotName,
}
