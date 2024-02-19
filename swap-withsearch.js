const ethers = require('ethers')
require('dotenv').config()
const pools = require('./data/pools.json')
const axios = require('axios')
const fs = require('fs').promises;

const INFURA_URL = process.env.INFURA_URL
const privateKey = process.env.WALLET_SECRET

const v3PoolArtifact = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json")
const v2PairArtifact = require('@uniswap/v2-periphery/build/IUniswapV2Pair.json')
const v2RouterArtifact = require('./artifacts/V2ROUTER.json')
const WMATICABI = require('./artifacts/WMATICABI.json')
const FlashLoanExampleABI = require('./artifacts/FlashLoanSwapTest.json')

const owner = "0x0040DEf8786BE2f596E9b74d50Ae3eC4A3bFa446"
const flashLoanContractAdress = "0xb873d1C35CF639552c36670c277389d665944867"
  //pool being tested from list of pools 51 DAI 31USDC 41USDT 1CRV 4PolyDoge
const BORROW = 100
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

//console.log(owner)
//console.log(_params)
let AVAX_PAIRS = {
    poolIdA: "0xeb477ae74774b697b5d515ef8ca09e24fee413b5",
    poolIdB: "0x3370c17c0411d2ce90a59162e3b3ec348c84768d",
    token0:'0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
    token1:'0x2c89bbc92bd86f8075d1decc58c7f4e0107f286b',
    tokenDecimals0:18,
    tokenDecimals1:18,
    exchangeNameA:"quickswap",
    exchangeNameB:"sushiswap",
    swapRouterAdressA:"0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
    swapRouterAdressB:"0x1b02da8cb0d097eb8d57a175b88c7d8b47997506",
    tokenName:"AVAX",
  }

  let UNI_PAIRS = {
    poolIdA: "0x7fae0648684ec375176e2d0f171ca9814798d920",
    poolIdB: "0xc45092e7e73951c6668f6c46acfca9f2b1c69aef",
    token0:'0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
    token1:'0xb33eaad8d922b1083446dc23f610c2567fb5180f',
    tokenDecimals0:18,
    tokenDecimals1:18,
    exchangeNameA:"quickswap",
    exchangeNameB:"sushiswap",
    swapRouterAdressA:"0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
    swapRouterAdressB:"0x1b02da8cb0d097eb8d57a175b88c7d8b47997506",
    tokenName:"UNI",
  }
  let CRV_PAIRS = {
    poolIdA: "0x634f9d9f8680349b518cb615017c105af46ccfd2",
    poolIdB: "0x140ea3fae80a2732ebc4de0511ff84ef1a575217",
    token0:'0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
    token1:'0x172370d5cd63279efa6d502dab29171933a610af',
    tokenDecimals0:18,
    tokenDecimals1:18,
    exchangeNameA:"quickswap",
    exchangeNameB:"sushiswap",
    swapRouterAdressA:"0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
    swapRouterAdressB:"0x1b02da8cb0d097eb8d57a175b88c7d8b47997506",
    tokenName:"CRV",
  }

  let SHIB_PAIRS = {
    poolIdA: "0x5fb641de2663e8a94c9dea0a539817850d996e99",
    poolIdB: "0xc284a7549048245a941f425a4fe9746b174b0770",
    token0:'0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
    token1:'0x6f8a06447ff6fcf75d803135a7de15ce88c1d4ec',
    tokenDecimals0:18,
    tokenDecimals1:18,
    exchangeNameA:"quickswap",
    exchangeNameB:"sushiswap",
    swapRouterAdressA:"0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
    swapRouterAdressB:"0x1b02da8cb0d097eb8d57a175b88c7d8b47997506",
    tokenName:"SHIB",
  }

  let AAVE_PAIRS = {
    poolIdA: "0x0554059d42e26f35cc958581c71fdfd92405d02f",
    poolIdB: "0x7d88d931504d04bfbee6f9745297a93063cab24c",
    token0:'0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
    token1:'0xd6df932a45c0f255f85145f286ea0b292b21c90b',
    tokenDecimals0:18,
    tokenDecimals1:18,
    exchangeNameA:"quickswap",
    exchangeNameB:"sushiswap",
    swapRouterAdressA:"0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
    swapRouterAdressB:"0x1b02da8cb0d097eb8d57a175b88c7d8b47997506",
    tokenName:"AAVE",
  }

  let MANA_PAIRS = {
    poolIdA: "0x6b0ce31ead9b14c2281d80a5dde903ab0855313a",
    poolIdB: "0x672d867b6f598a24fa0588c7bc181019d7db84ca",
    token0:'0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
    token1:'0xa1c57f48f0deb89f569dfbe6e2b7f46d33606fd4',
    tokenDecimals0:18,
    tokenDecimals1:18,
    exchangeNameA:"quickswap",
    exchangeNameB:"sushiswap",
    swapRouterAdressA:"0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
    swapRouterAdressB:"0x1b02da8cb0d097eb8d57a175b88c7d8b47997506",
    tokenName:"MANA",
  }

  let FISH_PAIRS = {
    poolIdA: "0x289cf2b63c5edeeeab89663639674d9233e8668e",
    poolIdB: "0xcbf6f78981e63ef813cb71852d72a060b583eecf",
    token0:'0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
    token1:'0xa1c57f48f0deb89f569dfbe6e2b7f46d33606fd4',
    tokenDecimals0:18,
    tokenDecimals1:18,
    exchangeNameA:"quickswap",
    exchangeNameB:"sushiswap",
    swapRouterAdressA:"0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
    swapRouterAdressB:"0x1b02da8cb0d097eb8d57a175b88c7d8b47997506",
    tokenName:"MANA",
  }


  

  let PAIRS = AVAX_PAIRS
  /*_params ={
    token0:PAIRS.token0, 
    token1:PAIRS.token1,
    router0:PAIRS.swapRouterAdressB,  //set this params depending on output 
    router1:PAIRS.swapRouterAdressA

}



runFlash(_params)*/


let BUY_AMOUNT = BORROW
let aaveFee = BUY_AMOUNT *0.001
let tradeFee = 2 * (BUY_AMOUNT*0.003)
let slippage = 2 *(BUY_AMOUNT* 0.005)
let gasFee = 0.08
let feeThreshold = BUY_AMOUNT + aaveFee + tradeFee + slippage

let stopInterval = false
let getPricesInterval = null


//!!!FLASH STUFF DONT TOUCH 
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
    console.log("flash loan contract balance token0:",ethers.utils.formatUnits(String(flashContractBalance0),PAIRS.tokenDecimals0))
    console.log("flash loan contract balance token1:",ethers.utils.formatUnits(String(flashContractBalance1),PAIRS.tokenDecimals1))

    console.log("owner wallet address:",owner)
    console.log("owner wallet balance token0:",ethers.utils.formatUnits(String(ownerContractBalance0),PAIRS.tokenDecimals0) ) //make sure to get the decimals for the contract for easy reading
    console.log("owner wallet contract balance token1:", ethers.utils.formatUnits(String(ownerContractBalance1),PAIRS.tokenDecimals1))

    console.log("Borrowing:",BORROW," = ",convertToContractValue(BORROW, 18))


    
    try{
    
  
        const txn = await flashLoanContract.getERC20Balance(_params.token0); 
        console.log(ethers.utils.formatUnits(String(txn),PAIRS.tokenDecimals0))
       
        
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


const getCurrentPrice= async (poolAddress) => {
    //const poolAddress = POOL_DATA.id;
    const apiUrl = `https://api.geckoterminal.com/api/v2/networks/polygon_pos/pools/${poolAddress}/ohlcv/minute?limit=1`;
    let currentPrice
    try {
        const response = await axios.get(apiUrl);
        const data = response.data;
       
        //console.log(data.data.attributes.ohlcv_list[0])
        if(data.data.attributes.ohlcv_list.length ===0){ ///TODO:check length isn't 0
          currentPrice=null
          
        }else{
          currentPrice = data.data.attributes.ohlcv_list[0][4]
          
        }
       
        //return currentPrice;
    } catch (error) {
        console.error('Error fetching data:', error.message);
        throw error;
    }
    return currentPrice;
    
}

const getPrices = async () => {
    if(!stopInterval){
        //for testing
    let poolAddressA = PAIRS.poolIdA
    let poolAddressB = PAIRS.poolIdB

    let priceA = await getCurrentPrice(poolAddressA)
    let priceB = await getCurrentPrice(poolAddressB)

    //console.log(priceA)
    //console.log(priceB)
    let prices ={
        priceA,
        priceB
    }
    console.log(prices)

    //check if they are equal 
    if(prices.priceA !== prices.priceB && (prices.priceA!==null&&prices.priceB!==null) ){
        console.log("prices aren't equal - potential opp on: ",PAIRS.tokenName)
        spread = (prices.priceA-prices.priceB )*BUY_AMOUNT
        console.log('fee threshold',feeThreshold)
        console.log('spread',spread) 
        let path = [PAIRS.token0, PAIRS.token1]
        let decimals = [PAIRS.tokenDecimals0, PAIRS.tokenDecimals1]
        //instead of 0 we need a value that takes into account the fee but for test purposes zero is fine
        //the value the comes through when swap test doesn't fail is your best bet
        if(spread>gasFee){//TODO: CALCULATE THIS PROPORTIOALLY TO FEES - this can be used in swap test
            /**
             * Simple check spread*BUYAMOUNT > gas fee
             */
            //A > B - buy on B
            console.log("buy on B sell on A")
            let swapTestB = await swapTest(BUY_AMOUNT,PAIRS.swapRouterAdressB, PAIRS.swapRouterAdressA,path,decimals)
            if(swapTestB){
                console.log("run flash swap B -> A: ",PAIRS.tokenName)
                stopInterval=true
                clearInterval(getPricesInterval)

                _params ={
                    token0:PAIRS.token0, 
                    token1:PAIRS.token1,
                    router0:PAIRS.swapRouterAdressB,  //set this params depending on output 
                    router1:PAIRS.swapRouterAdressA
                
                }
                
                
                
                await runFlash(_params)
                console.log("Flash swap completed:", Date.now())
            }else{
                console.log("prices show opp but router says stop")
            }
        }else if (spread<gasFee){
            //B> A - buy on A
            console.log("buy on A sell on B")
            let swapTestA = await swapTest(BUY_AMOUNT,PAIRS.swapRouterAdressA, PAIRS.swapRouterAdressB,path,decimals)
            if(swapTestA){
                console.log("run flash swap A->B",PAIRS.tokenName)
                stopInterval = true
                clearInterval(getPricesInterval)

                _params ={
                    token0:PAIRS.token0, 
                    token1:PAIRS.token1,
                    router0:PAIRS.swapRouterAdressA,  //set this params depending on output 
                    router1:PAIRS.swapRouterAdressB
                
                }
                
                
                
                await runFlash(_params)
                console.log("Flash swap completed:", Date.now())
            }else{
                console.log("prices show opp but router says stop",PAIRS.tokenName)
            }
        }else{
            console.log("prices aren't equal no opp - spread too low")
        }



    }else{
        console.log("prices are equal no opp")
    }

    //if they aren't run the official swap test 
    return(prices)

    }
    

}

const swapTest = async (amountIn, swapRouter0,swapRouter1, path, decimals) => {
    console.log("debug swap test 0")
    //if swap test returns true then you can run arbitrage otherwise start again
    let result = false
    let buyResult = await buyPriceCheck(swapRouter0,amountIn,path, decimals)
    let _path = path.reverse()
    let _decimals = decimals.reverse()
    let sellResult = await sellPriceCheck(swapRouter1,buyResult,_path, _decimals)
    //test fee thresh hold (0.005) - later worry about exchange stuff
    let testAaveThreshold = BUY_AMOUNT + (BUY_AMOUNT * 0.006) + gasFee
    if(sellResult>testAaveThreshold){
        result = true
    }
    console.log("sell result",sellResult)
    console.log("amount in",amountIn)
    console.log("debug swap test 1")
    return result 
}

const _getGasPrice = async() =>{
    let gasPrice = await provider.getGasPrice() /*Create separate function */
    let gasPriceGWEI = ethers.utils.formatUnits(gasPrice, "gwei")
    console.log(`gas price ${gasPriceGWEI.toString()}`)
    //console.log(Math.round((parseInt(Math.round(gasPriceGWEI))*0.30))+ gasPriceGWEI)
    let gasBuffered = Math.round(parseInt(gasPriceGWEI) + Math.round((parseInt(gasPriceGWEI)*0.50))) //increase by 25% 
    console.log(`gas price +40% ${gasBuffered.toString()}`)
    return gasBuffered.toString()
}

async function approveTokenSpending(tokenAddress,amountIn,swapRouterAddress) { //rewrite this to take both direction and save time
    
    //const wallet = new ethers.Wallet(privateKey, provider);
    const wallet = new ethers.Wallet(privateKey)
    const connectedWallet = wallet.connect(provider)
    //let setSwapRouterAddress()
  
    // Replace with the ABI for the ERC-20 token (standard token ABI)
    const tokenABI = WMATICABI.abi
    const tokenContract = new ethers.Contract(tokenAddress, tokenABI, wallet);
    console.log("approval token address", tokenAddress)
  
    // Replace with the maximum value or the amount you want to approve
   
  
    // Replace with the spender address (SushiSwap Router in this case)

    /**
     *  const connectedWallet = wallet.connect(provider) //this could be the answer to any issues faced tbh
        let gas = await calculateGas()
        const flashTx = await flashLoanContract.connect(connectedWallet).createFlashLoan(
     */
    
    //const approvalTx = await tokenContract.approve(owner, maxApproval);
    //amountIn = BUY_AMOUNT
    


    console.log("debug approve 1")
    let gasPrice = await _getGasPrice()
    console.log(typeof amountIn)
    console.log(amountIn)
    //let _buff_amount = amountIn.toFixed(2) +1
    const approvalTx = await tokenContract.connect(connectedWallet).approve(
        swapRouterAddress,
        approvalAmount = amountIn.toString(),
        //approvalAmount = ethers.utils.parseUnits(amountIn.toString(), decimal).toString(),
        {gasLimit: ethers.utils.hexlify(200000), //this is optimum gas for approval
          gasPrice: ethers.utils.parseUnits(gasPrice, "gwei")}
      )/*.then( async approvalResponse => {
        console.log("tx:approve")
        console.log("approve hash:",approvalResponse.hash)
        await approvalResponse.wait();
        console.log(`Approved spending on token ${tokenAddress} for ${owner}`);
        //let tradeTransaction = await this.runTx(transaction,swapData,connectedWallet, gasBuffered)
        //swapData = tradeTransaction
      })*/
      console.log(approvalTx.hash)
      console.log("debug approve 2")
      await approvalTx.wait()
      console.log(`Approved spending on token ${tokenAddress} for ${owner}`);
      
      return
    //
  
    
  }

const buyPriceCheck = async (swapRouter0,_amountIn,path, decimals) =>{
    console.log("debug buy")
   
    //const amountIn  = ethers.utils.parseUnits(_amountIn.toString(), decimals[0])
    const amountIn  = ethers.utils.parseUnits(_amountIn.toString(), decimals[0])
    const wallet = new ethers.Wallet(privateKey, provider);

    //await approveTokenSpending(path[0],amountIn,swapRouter0)
    const swapRouter = new ethers.Contract(swapRouter0, v2RouterArtifact.abi, wallet);
    const amountsOut = await swapRouter.getAmountsOut(amountIn, path); 
 
    const amountOutMin = amountsOut[amountsOut.length - 1];
    const amountOut = ethers.utils.formatUnits(String(amountOutMin),decimals[1])

    console.log("buy Amount out MIN",amountOut)
   
    return amountOut
}

const sellPriceCheck = async(swapRouter1,_amountIn,path, decimals) => {
    console.log("debug sell")
    const amountIn  = ethers.utils.parseUnits(_amountIn.toString(), decimals[0])
    const wallet = new ethers.Wallet(privateKey, provider);
    const swapRouter = new ethers.Contract(swapRouter1, v2RouterArtifact.abi, wallet);
    const amountsOut = await swapRouter.getAmountsOut(amountIn, path); 
    const amountOutMin = amountsOut[amountsOut.length - 1];
    const amountOut = ethers.utils.formatUnits(String(amountOutMin),decimals[1])
    console.log("Sell Amount out MIN",amountOut)
    return amountOut

}

const _run = async () => {
    //let prices = await getPrices()
    
    getPricesInterval = setInterval(getPrices, 0.5 * 60000);

}

_run()


