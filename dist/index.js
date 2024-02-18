"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const tweetnacl_1 = __importDefault(require("tweetnacl"));
const tweetnacl_util_1 = __importDefault(require("tweetnacl-util"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// 替换为你的 API 密钥和私钥
const apiKey = process.env.APIKEY;
const privateKeyBase64 = process.env.PK;
const symbolName = process.env.SYMBOL;
const tradeValue = parseFloat(process.env.VAL);
const generateSignature = (instruction, privateKeyBase64, timestamp, params) => {
    // 将参数按键排序
    const paramString = getParamString(params);
    const dataToSign = `instruction=${instruction}&${paramString}timestamp=${timestamp}&window=5000`;
    // 解码私钥并签名
    const privateKey = tweetnacl_util_1.default.decodeBase64(privateKeyBase64);
    const keyPair = tweetnacl_1.default.sign.keyPair.fromSeed(privateKey);
    const signature = tweetnacl_1.default.sign.detached(tweetnacl_util_1.default.decodeUTF8(dataToSign), keyPair.secretKey);
    // 返回 Base64 编码的签名
    return tweetnacl_util_1.default.encodeBase64(signature);
};
const getParamString = (params) => {
    if (params) {
        const sortedParams = Object.keys(params).sort().reduce((obj, key) => {
            obj[key] = params[key];
            return obj;
        }, {});
        // 构造要签名的字符串
        const paramString = Object.keys(sortedParams).map(key => `${key}=${sortedParams[key]}`).join('&');
        return paramString + "&";
    }
    else {
        return "";
    }
};
const getPrice = (symbol) => __awaiter(void 0, void 0, void 0, function* () {
    const endpoint = "https://api.backpack.exchange/api/v1/depth";
    const params = {
        "symbol": symbol
    };
    try {
        const resp = yield axios_1.default.get(endpoint, { params });
        const data = resp.data;
        const ask = data.asks;
        const bid = data.bids;
        return {
            "ask": ask[0][0],
            "bid": bid[bid.length - 1][0]
        };
    }
    catch (err) {
        console.error(err);
    }
});
const privateCall = (endpoint, method, instruction, params) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const windowTime = 5000;
        const timestamp = new Date().getTime();
        const signatureBase64 = generateSignature(instruction, privateKeyBase64, timestamp, params);
        const headers = {
            'X-API-Key': apiKey,
            'X-Timestamp': timestamp.toString(),
            'X-Window': windowTime.toString(),
            'X-Signature': signatureBase64
        };
        const resp = yield (0, axios_1.default)({
            method,
            url: endpoint,
            data: params,
            headers: headers,
        });
        return resp.data;
    }
    catch (err) {
        console.error(err);
    }
});
const formatNumber = (num) => {
    return Math.floor(num * 100) / 100;
};
const trade = (symbol, value) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // cancel open orders
        yield cancelOrders(symbol);
        // get price
        const price = yield getPrice(symbol);
        const coinName = getCoinName(symbol);
        const coinAmt = yield getCoinAmt(coinName.coin);
        console.log("当前余额", coinName.coin, coinAmt);
        if (coinAmt && coinAmt >= 0.1) {
            console.log("卖出", coinName.coin, coinAmt);
            yield sell(symbol, price === null || price === void 0 ? void 0 : price.bid, coinAmt);
        }
        const baseAmt = yield getCoinAmt(coinName.base);
        console.log("当前余额", coinName.base, baseAmt);
        if (value > baseAmt || baseAmt == undefined) {
            console.log("余额不足");
            return;
        }
        const amt = (value / (price === null || price === void 0 ? void 0 : price.ask)).toFixed(2);
        console.log("买入", coinName.coin, amt);
        yield buy(symbol, price === null || price === void 0 ? void 0 : price.ask, amt);
    }
    catch (err) {
        console.error(err);
    }
});
const cancelOrders = (symbol) => __awaiter(void 0, void 0, void 0, function* () {
    yield privateCall("https://api.backpack.exchange/api/v1/orders", "DELETE", "orderCancelAll", { "symbol": symbol });
});
const sell = (symbol, price, amt) => __awaiter(void 0, void 0, void 0, function* () {
    yield privateCall("https://api.backpack.exchange/api/v1/order", "POST", "orderExecute", { "symbol": symbol, "orderType": "Limit", "price": price, "side": "Ask", "quantity": formatNumber(amt).toFixed(2) });
});
const buy = (symbol, price, value) => __awaiter(void 0, void 0, void 0, function* () {
    yield privateCall("https://api.backpack.exchange/api/v1/order", "POST", "orderExecute", { "symbol": symbol, "orderType": "Limit", "price": price, "side": "Bid", "quantity": value });
});
const getCoinName = (symbol) => {
    return {
        "coin": symbol.split("_")[0],
        "base": symbol.split("_")[1]
    };
};
const getCoinAmt = (coinName) => __awaiter(void 0, void 0, void 0, function* () {
    const balance = yield balanceQuery();
    const value = coinName in balance ? balance[coinName] : undefined;
    if (value) {
        return parseFloat(value.available);
    }
    else {
        return undefined;
    }
});
const balanceQuery = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const resp = yield privateCall("https://api.backpack.exchange/api/v1/capital", "GET", "balanceQuery");
        return resp;
    }
    catch (err) {
        console.error(err);
    }
});
const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};
const main = () => __awaiter(void 0, void 0, void 0, function* () {
    while (true) {
        try {
            trade(symbolName, tradeValue);
            yield sleep(3000);
        }
        catch (err) {
            console.error(err);
        }
    }
});
main();
