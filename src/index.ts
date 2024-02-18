import axios from 'axios';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import dotenv from "dotenv"
dotenv.config()

// 替换为你的 API 密钥和私钥
const apiKey = process.env.APIKEY!
const privateKeyBase64 = process.env.PK!
const symbolName = process.env.SYMBOL!
const tradeValue = parseFloat(process.env.VAL!)

const generateSignature = (instruction: string, privateKeyBase64: string, timestamp: number, params?: { [key: string]: string }): string => {
    // 将参数按键排序
    const paramString = getParamString(params)
    const dataToSign = `instruction=${instruction}&${paramString}timestamp=${timestamp}&window=5000`;

    // 解码私钥并签名
    const privateKey = naclUtil.decodeBase64(privateKeyBase64);
    const keyPair = nacl.sign.keyPair.fromSeed(privateKey);
    const signature = nacl.sign.detached(naclUtil.decodeUTF8(dataToSign), keyPair.secretKey);

    // 返回 Base64 编码的签名
    return naclUtil.encodeBase64(signature);
}

const getParamString = (params?: { [key: string]: string }): string => {
    if (params) {
        const sortedParams = Object.keys(params).sort().reduce((obj, key) => {
            obj[key] = params[key];
            return obj;
        }, {} as { [key: string]: string });

        // 构造要签名的字符串
        const paramString = Object.keys(sortedParams).map(key => `${key}=${sortedParams[key]}`).join('&');
        return paramString + "&"

    } else {
        return ""
    }
}

const getPrice = async (symbol: string) => {
    const endpoint = "https://api.backpack.exchange/api/v1/depth"
    const params = {
        "symbol": symbol
    }
    try {
        const resp = await axios.get(endpoint, { params })
        const data = resp.data
        const ask = data.asks
        const bid = data.bids
        return {
            "ask": ask[0][0],
            "bid": bid[bid.length - 1][0]
        }
    } catch (err) {
        console.error(err)
    }

}

const privateCall = async (endpoint: string, method: string, instruction: string, params?: { [key: string]: string }) => {
    try {
        const windowTime = 5000
        const timestamp = new Date().getTime();
        const signatureBase64 = generateSignature(instruction, privateKeyBase64, timestamp, params)

        const headers = {
            'X-API-Key': apiKey,
            'X-Timestamp': timestamp.toString(),
            'X-Window': windowTime.toString(),
            'X-Signature': signatureBase64
        };
        const resp = await axios({
            method,
            url: endpoint,
            data: params,
            headers: headers,
        })
        return resp.data
    } catch (err) {
        console.error(err)
    }
}

const formatNumber = (num: number) => {
    return Math.floor(num * 100) / 100;
}


const trade = async (symbol: string, value: number) => {
    try {

        // cancel open orders
        await cancelOrders(symbol)
        // get price
        const price = await getPrice(symbol)
        const coinName = getCoinName(symbol)
        const coinAmt = await getCoinAmt(coinName.coin)
        console.log("当前余额", coinName.coin, coinAmt)
        if (coinAmt && coinAmt >= 0.1) {
            console.log("卖出", coinName.coin, coinAmt)
            await sell(symbol, price?.bid, coinAmt)
        }

        const baseAmt = await getCoinAmt(coinName.base)
        console.log("当前余额", coinName.base, baseAmt)
        if (value > baseAmt! || baseAmt == undefined) {
            console.log("余额不足")
            return
        }
        const amt = (value / price?.ask).toFixed(2)
        console.log("买入", coinName.coin, amt)
        await buy(symbol, price?.ask, amt)

    } catch (err) {
        console.error(err)
    }

}

const cancelOrders = async (symbol: string) => {
    await privateCall("https://api.backpack.exchange/api/v1/orders", "DELETE", "orderCancelAll", { "symbol": symbol })
}

const sell = async (symbol: string, price: string, amt: number) => {
    await privateCall("https://api.backpack.exchange/api/v1/order", "POST", "orderExecute", { "symbol": symbol, "orderType": "Limit", "price": price, "side": "Ask", "quantity": formatNumber(amt).toFixed(2) })
}

const buy = async (symbol: string, price: string, value: string) => {
    await privateCall("https://api.backpack.exchange/api/v1/order", "POST", "orderExecute", { "symbol": symbol, "orderType": "Limit", "price": price, "side": "Bid", "quantity": value })
}

const getCoinName = (symbol: string) => {
    return {
        "coin": symbol.split("_")[0],
        "base": symbol.split("_")[1]
    }
}

const getCoinAmt = async (coinName: string) => {
    const balance = await balanceQuery()
    const value = coinName in balance ? balance[coinName] : undefined
    if (value) {
        return parseFloat(value.available)
    } else {
        return undefined
    }
}

const balanceQuery = async () => {
    try {
        const resp = await privateCall("https://api.backpack.exchange/api/v1/capital", "GET", "balanceQuery")
        return resp
    } catch (err) {
        console.error(err)
    }
}

const sleep = (ms: number) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}


const main = async () => {
    while (true) {
        try {
            trade(symbolName, tradeValue)
            await sleep(3000)
        } catch (err) {
            console.error(err)
        }

    }
}

main()
