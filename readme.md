# Backpack 刷单

## 严正警告
本程序不保证从交易中赚钱，实际上大概率是亏钱的。亏钱了别找我，发空投赚麻了可以考虑给我发个红包。

## 使用教程
1. 下载Node.js 环境，https://nodejs.org/en/download , 从前面的链接下载你对应系统的环境安装
2. 生成api_key, 链接 https://backpack.exchange/settings/api-keys , 点击New Api key 生成, 生成完后注意保存，其中api key为公钥，api secret key为私钥
3. 解压进入文件夹，把.env.example 文件改名为.env, 然后在里面填写你的API公私钥，公钥填写在API=后面，私钥填写在PK=后面，下面两个配置分别为交易对名称，格式如SOL_USDC；最后一个配置为交易单笔金额，配置的10意思为10U（因此请使用USDC或者USDT交易对，使用其他交易对出问题我也不负责）
4. 在文件夹空白处点击右键，选择在Powershell中运行/或者在终端中运行。
5. 输入命令 `npm install`，安装环境
6. 运行指令 `node dist/index.js`
7. 注意余额，可能会刷完
