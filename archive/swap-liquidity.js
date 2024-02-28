const ethers = require('ethers')
require('dotenv').config()
const pools = require('../data/pools.json')

const INFURA_URL = process.env.INFURA_URL

const v3PoolArtifact = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json")
const v2PairArtifact = require('@uniswap/v2-periphery/build/IUniswapV2Pair.json')
const WMATICABI = require('../artifacts/WMATICABI.json')
const FlashLoanExampleABI = require('../artifacts/FlashLoanSwapTest.json')

const owner = "0x0040DEf8786BE2f596E9b74d50Ae3eC4A3bFa446"
const flashLoanContractAdress = "0xb873d1C35CF639552c36670c277389d665944867"
const poolNumber = 41  //pool being tested from list of pools 51 DAI 31USDC 41USDT 1CRV 4PolyDoge
const BORROW = 1


//NEW STRATEGY

/**
 * 
 * Don't need to check for prices, just check for large amount0In or amount1In, 
 * large amount0In - Buy this mean price up here(Sell on this exchange)
 * large amount1In - Sell - this mean price down here(Buy on this exchange)
 */
/**
 * UNUSED - Useful for V3 swaps but pointless now
 */
sqrtToPrice = (sqrt) => {
    const numerator = sqrt ** 2
    const denominator = 2 ** 192
    let ratio = numerator / denominator
    const decimalShift = Math.pow(10, -12) //token 0 -token 1 decimals
    ratio = ratio * decimalShift
    return ratio
}

const provider = new ethers.providers.JsonRpcProvider(INFURA_URL)
//const wallet = new ethers.Wallet(process.env.WALLET_SECRET, provider);
//const signer = provider.getSigner(wallet.address)



//const v3Pool = new ethers.Contract(USDC_ETH_V3, v3PoolArtifact.abi, provider)
//const v2Pair = new ethers.Contract(ETH_USDT_V2, v2PairArtifact.abi, provider)
let pool1 = pools[poolNumber].pool
let pool2 = pools[poolNumber].matches[0]
let poolId1 = pool1.id
let poolId2 = pool2.id

let tokenDecimals0 = pool1.inputTokens[0].decimals
let tokenDecimals1 = pool1.inputTokens[1].decimals
const pairA = new ethers.Contract(poolId1, v2PairArtifact.abi, provider)
const pairB = new ethers.Contract(poolId2, v2PairArtifact.abi, provider)

/*
*Rewrite this as a function for better encapsulation later
*/

let decimalShift = tokenDecimals0 - tokenDecimals1
ratio0ToPrice = (amount0In, amount1Out) => 1/(Number(amount0In)/Number(amount1Out)/10**decimalShift)
ratio1ToPrice = (amount1In, amount0Out) => Number(amount1In)/Number(amount0Out)*10**decimalShift //feels off? invert dshirt?

let poolPricesA = {
    t0 : 0,
    t1 : 0,


}

let poolPricesB = {
    t0 : 0,
    t1 : 0,

}




async function swapResponse(pool, amounts, prices) {
    const currentDate = new Date();
    let r0 = ratio0ToPrice(amounts.amount0In, amounts.amount1Out)
    let r1 = ratio1ToPrice(amounts.amount1In, amounts.amount0Out)
    let result = false
    let params; 
    console.log(
        'pair:', pool.name, '|',
        'ratio0:', r0,
        'ratio1:', r1,
        'time', currentDate
    )
    if(Number.isNaN(r0)){
        prices.t1 = r1
    
    }else if(Number.isNaN(r1)){
        prices.t0 = r0
    }

    if((poolPricesA.t0 !==0 && poolPricesB.t0!==0)){
        console.log(poolPricesA)
        console.log(poolPricesB)
        
        if(poolPricesA.t0>poolPricesB.t0){
            console.log("\nFlashSwap ? A -> B?");
            spread = poolPricesA.t0 - poolPricesB.t0
            let spreadWFee = spread + (spread*0.005) //should increase fee long term to include gas fees
            
            if(spreadWFee>0.01){
                console.log("\nFlashSwap  A -> B");
                console.log('spreadWFee',spreadWFee)
                let params = {token0: pool1.inputTokens[0].id,token1: pool1.inputTokens[1].id,router0:pool1.factory,router1:pool2.factory} 
                console.log(params)
                return params

            }else{
                console.log('spreadWFee',spreadWFee)
                console.log("spread to low")
                return params
            }
            
            
        }else if (poolPricesB.t0>poolPricesA.t0){
            console.log("\nFlashSwap ? B -> A?");
            spread = poolPricesB.t0 - poolPricesA.t0
            let spreadWFee = spread + (spread*0.005)//should increase fee long term to include gas fees
            if(spreadWFee>0.01){ //isntead of 0 do 0.01
                console.log("\nFlashSwap  B -> A");
                console.log('spreadWFee',spreadWFee)
                let params = {token0: pool1.inputTokens[0].id,token1: pool1.inputTokens[1].id,router0:pool2.factory,router1:pool1.factory}
                console.log(params)
                return params

            }else{
                console.log('spreadWFee',spreadWFee)
                console.log("spread to low")
                return params
            }
            
        }else{
            console.log("T1 but no T0 - or other reason - no swap")
            return params
        }
        //t1diff = poolPricesA.t1 - poolPricesB.t1 don't inverse yet
        
    }
    
    console.log(poolPricesA)
    console.log(poolPricesB)
    console.log("Zero Value - no swap")
    return params

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
    const contractValue = ethers.utils.parseUnits(value.toString(), decimals);
    return contractValue;
}

async function calculateGas() {
    //TODO: document and explain to Emai
    let gasPrice = await provider.getGasPrice()
    let gasPriceGWEI = ethers.utils.formatUnits(gasPrice, "gwei")
    let gasBuffered = Math.round(gasPriceGWEI + 10) //long term play around with this basd on other useful data?
    
    let gas = ethers.utils.parseUnits(gasBuffered.toString(), "gwei")
    console.log(`gas price ${gasBuffered.toString()}`)
    return gas
}


async function runFlash(_params) {
    console.log("Starting running flash loan contract ")
   
    const tokenContract0 = new ethers.Contract(_params.token0, WMATICABI.abi, provider)
    const tokenContract1 = new ethers.Contract(_params.token1, WMATICABI.abi, provider)
    //const _provider = new ethers.BrowserProvider(window.ethereum);
    //const signer = await _provider.getSigner();
    const flashLoanContract = new ethers.Contract(flashLoanContractAdress, FlashLoanExampleABI.abi, provider)

    const flashContractBalance0 = await tokenContract0.balanceOf(flashLoanContractAdress);
    const flashContractBalance1 = await tokenContract1.balanceOf(flashLoanContractAdress);
    const ownerContractBalance0 = await tokenContract0.balanceOf(owner);
    const ownerContractBalance1 = await tokenContract1.balanceOf(owner);
    //const tokenDecimals0 = tokenContract0.decimals() //these will be passed in with the address and symbol
    //const tokenDecimals1 = tokenContract1.decimals() //these will be passed in with the address and symbol

    

    //original balance
    console.log("flash loan contract address:",flashLoanContractAdress)
    console.log("flash loan contract balance token0:",ethers.utils.formatUnits(String(flashContractBalance0),tokenDecimals0))
    console.log("flash loan contract balance token1:",ethers.utils.formatUnits(String(flashContractBalance1),tokenDecimals1))

    console.log("owner wallet address:",owner)
    console.log("owner wallet balance token0:",ethers.utils.formatUnits(String(ownerContractBalance0),tokenDecimals0) ) //make sure to get the decimals for the contract for easy reading
    console.log("owner wallet contract balance token1:", ethers.utils.formatUnits(String(ownerContractBalance1),tokenDecimals1))

    console.log("Borrowing:",BORROW," = ",convertToContractValue(BORROW, 18))


    
    try{
    
  
        const txn = await flashLoanContract.getERC20Balance(_params.token0); 
        console.log(ethers.utils.formatUnits(String(txn),tokenDecimals0))
       
        
    }catch(err){
          console.log(err)
          //make arbitrage and create flash loan might be the main issue here.
    }

    //let abiCoder = ethers.AbiCoder.defaultAbiCoder() v6
    
    //let abiCoder = ethers.utils.defaultAbiCoder
    const params = ethers.utils.defaultAbiCoder.encode(["address","address","address","address"],[_params.token0,_params.token1,_params.router0,_params.router1])
    console.log("params encoded")
    /*try{
        const txn = await flashLoanContract.createFlashLoan(_params.token0, convertToContractValue(BORROW, 18),params); //FIXME:change to decimals
        console.log(txn)
        await txn.wait();
    
        console.log("transaction complete")
        console.log(txn.hash)
        const balance = await flashLoanContract.getERC20Balance("0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270");
        console.log(hre.ethers.formatUnits(String(balance),tokenDecimals0))
        
        }catch(err){
          console.log(err)
         
          //FIXME:ProviderError: execution reverted: UniswapV2: INSUFFICIENT_OUTPUT_AMOUNT
          //https://ethereum.stackexchange.com/questions/84668/swap-tokens-back-to-ether-on-uniswap-v2-router-02-sell-tokens
        
        }*/

    //approve the swap
    const wallet = new ethers.Wallet(process.env.WALLET_SECRET)
    const connectedWallet = wallet.connect(provider) //this could be the answer to any issues faced tbh
    let gas = await calculateGas()
    const flashTx = await flashLoanContract.connect(connectedWallet).createFlashLoan(
        _params.token0, 
        convertToContractValue(BORROW, 18),
        params, 
        {gasLimit: ethers.utils.hexlify(500000), //this is optimum gas for approval
            gasPrice: gas}) //use a buffer tracker tbh
    console.log(flashTx.hash)
    await flashTx.wait()
    const flashReceipt = await provider.waitForTransaction(flashTx.hash).then(
        flashReceipt => {  
          console.log(flashReceipt.status)
          console.log("flash complete")
        })


}


console.log("listening for swap")
console.log(pool1.name,pool2.name)


const swapEventHandlerA = async (sender, amount0In, amount1In, amount0Out, amount1Out, to) => {
    
    let amounts = {amount0In, amount1Out,amount1In, amount0Out}
    let result = await swapResponse(pool1,amounts, poolPricesA) //this is where you run the whole function ()
    console.log(result) //params for flash swap
    if(result==undefined){
        console.log("continue searching")
        
    }else{
        
        console.log("run flash")
        pairA.removeListener('Swap', swapEventHandlerA);
        pairB.removeListener('Swap', swapEventHandlerB);
        runFlash(result)
    }
    /**
     * if opp found = true run flash 
     */
    
}

const swapEventListenerA = pairA.on('Swap', swapEventHandlerA);

const swapEventHandlerB = async (sender, amount0In, amount1In, amount0Out, amount1Out, to) => {
  
    let amounts = {amount0In, amount1Out,amount1In, amount0Out}
    let result = await swapResponse(pool2,amounts,poolPricesB)
    console.log(result) //params for flash swap
    if(result==undefined){
       
        console.log("continue searching")
    }else{
        console.log("run flash")
        
        pairA.removeListener('Swap', swapEventHandlerA);
        pairB.removeListener('Swap', swapEventHandlerB);
        runFlash(result)
    }
    /**
     * if opp found = true run flash 
     */

}

const swapEventListenerB = pairB.on('Swap', swapEventHandlerB);