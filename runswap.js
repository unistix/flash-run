const {ethers} = require("ethers") //don't need hardhat to call the existing contracts
const v2PairArtifact = require('@uniswap/v2-periphery/build/IUniswapV2Pair.json')
//const { POOL_ADDRESS_PROVIDER } = require("../config");
const pools = require('./data/pools.json')
const WMATICABI = require('./artifacts/WMATICABI.json')
const FlashLoanExampleABI = require('./artifacts/FlashLoanExample.json')

const INFURA_URL = process.env.INFURA_URL

const owner = "0x0040DEf8786BE2f596E9b74d50Ae3eC4A3bFa446"
const flashLoanContractAdress = "0xb873d1C35CF639552c36670c277389d665944867"
const poolNumber = 31  //pool being tested from list of pools 51 DAI 31USDC
const BORROW = 1
const provider = new ethers.providers.JsonRpcProvider(INFURA_URL)

sqrtToPrice = (sqrt) => {
    /**
     * This function converts the square root of 
     * a Uniswap V3 pair price into the actual price. 
     * It is not used currently 
     */
    const numerator = sqrt ** 2
    const denominator = 2 ** 192
    let ratio = numerator / denominator
    const decimalShift = Math.pow(10, -12) // 6-18 = 12 T1decimals - T2 decimals = value (18-18 is zero!!)
    ratio = ratio * decimalShift
    return ratio
}
  
  
function convertToContractValue(value, decimals) {
    /**
     * Converts a value to the equivalent value in the smart contract's base unit. 
     */
  
  
    // Check if the value is a string or number
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new Error('Invalid input: value must be a string or number');
    }
  
    // Check if decimals is a positive integer
    if (!Number.isInteger(decimals) || decimals < 0) {
      throw new Error('Invalid input: decimals must be a non-negative integer');
    }
  
    // Convert the value to a BigNumber
    //const valueInBigNumber = ethers.toBigInt(value);
    // Convert the value to the base unit used by the smart contract
    const contractValue = ethers.parseUnits(value.toString(), decimals);
    return contractValue;
}

/**
 * Contract goes here
 */


function calculateRatioPrices (amounts, tokenDecimals0,tokenDecimals1){
    decimalShift = tokenDecimals0 - tokenDecimals1
    let ratio0ToPrice =  1/(Number(amounts.amount0In)/Number(amounts.amount1Out)/10**decimalShift)
    let ratio1ToPrice = Number(amounts.amount1In)/Number(amounts.amount0Out)*10**decimalShift
    return [ratio0ToPrice,ratio1ToPrice]
}



let pool1 = pools[poolNumber].pool
let pool2 = pools[poolNumber].matches[0]

let poolId1 = pool1.id
let poolId2 = pool2.id
let tokenDecimals0 = pool1.inputTokens[0].decimals
let tokenDecimals1 = pool2.inputTokens[1].decimals
let token0 = pool1.inputTokens[0].id
let token1 = pool2.inputTokens[1].id
let router0 = pool1.factory
let router1 = pool2.factory

//const pairA = new ethers.Contract(poolId1, v2PairArtifact.abi, provider)
//const pairB = new ethers.Contract(poolId2, v2PairArtifact.abi, provider)


console.log("listening for swap")
console.log(pool1.name," ",pool2.name)


let ratioTrackingValue; //this value allows you to track the price increase between exchanges
let rTVTempA = 0 //temporary for ExchangeA
let rTVTempB = 0 //tempotary for ExchangeB
let rTVPriceAt0 = 0;
let rTVPriceAt1 = 0;
let rTVPriceBt0 = 0;
let rTVPriceBt1 = 0;
let oppFound = false //if A>B or if B<A 

/**
 * calculate srepead
 * if A>B then run arbitrage sell on A and buy on B
 */

/**
 * calculate spread
 * if B>A then run arbitrage sell on A and buy on buy
 */

async function runFlash(_params) {
    console.log("RUNNING FLASH SWAP ")
    const tokenContract0 = new ethers.Contract(token0, WMATICABI.abi, provider)
    const tokenContract1 = new ethers.Contract(token1, WMATICABI.abi, provider)
    const flashLoanContract = new ethers.Contract(flashLoanContractAdress, FlashLoanExampleABI.abi, provider)

    console.log("flash loan contract address:",flashLoanContractAdress)
    const flashContractBalance0 = await tokenContract0.balanceOf(flashLoanContractAdress);
    const flashContractBalance1 = await tokenContract1.balanceOf(flashLoanContractAdress);
    const ownerContractBalance0 = await tokenContract0.balanceOf(owner);
    const ownerContractBalance1 = await tokenContract1.balanceOf(owner);
}

const pairA = new ethers.Contract(poolId1, v2PairArtifact.abi, provider)
const pairB = new ethers.Contract(poolId2, v2PairArtifact.abi, provider)

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

ratio0ToPrice = (amount0In, amount1Out) => 1/(Number(amount0In)/Number(amount1Out)/10**12)
ratio1ToPrice = (amount1In, amount0Out) => Number(amount1In)/Number(amount0Out)*10**12


pairA.on('Swap', (sender, amount0In, amount1In, amount0Out, amount1Out, to) => {
    console.log(
        'Sushi', '|',
        'pair:', pool1.name, '|',
        'sender:', sender, '|',
        'ratio0:', ratio0ToPrice(amount0In, amount1Out),
        'ratio1:', ratio1ToPrice(amount1In, amount0Out),
    )
})

pairB.on('Swap', (sender, amount0In, amount1In, amount0Out, amount1Out, to) => {
    console.log(
        'Ape', '|',
        'pair:', pool2.name, '|',
        'sender:', sender, '|',
        'ratio0:', ratio0ToPrice(amount0In, amount1Out),
        'ratio1:', ratio1ToPrice(amount1In, amount0Out),
    )
})