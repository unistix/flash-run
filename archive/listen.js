const ethers = require('ethers')
require('dotenv').config()
const pools = require('../data/pools.json')

const INFURA_URL = process.env.INFURA_URL

const v3PoolArtifact = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json")
const v2PairArtifact = require('@uniswap/v2-periphery/build/IUniswapV2Pair.json')

//const USDC_ETH_V3 = '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640' //polygon
//const ETH_USDT_V2 = '0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852' //wont 
//const ETH_USDT_SUSHI = '0xcd353f79d9fade311fc3119b841e1f456b54e858'

sqrtToPrice = (sqrt) => {
    const numerator = sqrt ** 2
    const denominator = 2 ** 192
    let ratio = numerator / denominator
    const decimalShift = Math.pow(10, -12)
    ratio = ratio * decimalShift
    return ratio
}

ratio0ToPrice = (amount0In, amount1Out) => 1/(Number(amount0In)/Number(amount1Out)/10**12)
ratio1ToPrice = (amount1In, amount0Out) => Number(amount1In)/Number(amount0Out)*10**12

const provider = new ethers.providers.JsonRpcProvider(INFURA_URL)

//const v3Pool = new ethers.Contract(USDC_ETH_V3, v3PoolArtifact.abi, provider)
//const v2Pair = new ethers.Contract(ETH_USDT_V2, v2PairArtifact.abi, provider)
let pool1 = pools[19].pool.id
let pool2 = pools[19].matches[0].id
const sushiPair = new ethers.Contract(pool1, v2PairArtifact.abi, provider)
const apePair = new ethers.Contract(pool2, v2PairArtifact.abi, provider)

/*
v3Pool.on('Swap', (sender, recipient, amount0, amount1, sqrtPriceX96) => {
    const ratio = sqrtToPrice(String(sqrtPriceX96))
    console.log(
        'Uni V3', '|',
        'pair:', 'ETH/USDC', '|',
        'sender:', sender, '|',
        'ratio:', 1/ratio,
    )
})


v2Pair.on('Swap', (sender, amount0In, amount1In, amount0Out, amount1Out, to) => {
    console.log(
        'Uni V2', '|',
        'pair:', 'ETH/USDT', '|',
        'sender:', sender, '|',
        'ratio0:', ratio0ToPrice(amount0In, amount1Out),
        'ratio1:', ratio1ToPrice(amount1In, amount0Out),
    )
})*/


console.log("listening for swap")
console.log(pool1,pool2)

sushiPair.on('Swap', (sender, amount0In, amount1In, amount0Out, amount1Out, to) => {
    console.log(
        'Sushi', '|',
        'pair:', pools[19].pool.name, '|',
        'sender:', sender, '|',
        'ratio0:', ratio0ToPrice(amount0In, amount1Out),
        'ratio1:', ratio1ToPrice(amount1In, amount0Out),
    )
})

apePair.on('Swap', (sender, amount0In, amount1In, amount0Out, amount1Out, to) => {
    console.log(
        'Ape', '|',
        'pair:', pools[19].matches[0].name, '|',
        'sender:', sender, '|',
        'ratio0:', ratio0ToPrice(amount0In, amount1Out),
        'ratio1:', ratio1ToPrice(amount1In, amount0Out),
    )
})