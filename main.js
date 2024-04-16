const axios = require("axios");
const ethers = require("ethers");
const {runFindPools} = require("./helper/find-pools.js")
const playSound = require("play-sound")();
const { buyNewToken, sellNewToken, getCurrentPrice,getCurrentPriceTest,arbitrageTest,arbitrageSwap,setSwapRouterAddress } = require("./helper/swap.js");
const {readPoolsFromSubgraphtoFile,savePoolstoFileTest} = require ("./helper/fileIO.js")
const {runFlash} = require("./main-flash.js")
require("dotenv").config();

const INFURA_URL = process.env.INFURA_URL;
const privateKey = process.env.WALLET_SECRET;
const owner = process.env.WALLET_ADDRESS;

//const v3PoolArtifact = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json")
const v2FactoryArtifact = require("./V2ABI.json");
const v2RouterArtifact = require("./V2ROUTER.json");
const v2PairArtifact = require("@uniswap/v2-periphery/build/IUniswapV2Pair.json");
const WMATICABI = require("./WMATICABI.json");

const provider = new ethers.providers.JsonRpcProvider(INFURA_URL);

const soundFilePathBuy = "./sounds/buy.mp3";
const soundFilePathSell = "./sounds/sell.mp3";

const BUY_AMOUNT = 150
const gasFee = 0.02 //We will switch this back to 5 long term
let complete = false

//TODO: Review TOKEN directions for liquidity


function calculatePercentageDiff(x, y) {
  // Calculate absolute difference
  x = Number(x)
  y = Number(y)
  const absoluteDifference = Math.abs(x - y);
  const average = (x + y) / 2;
  const percentageDifference = (absoluteDifference / average) * 100;
  
  return percentageDifference;
}

async function checkLiquidity(poolObject) {
  console.log("*Checking initial liquidity ...")



  const poolContract = new ethers.Contract(poolObject.pool.id, v2PairArtifact.abi, provider);
  

  //get liquidity for pool and update pool- object
  let poolReservesRaw = await poolContract.getReserves()
  let poolLq0 = ethers.utils.formatUnits(String(poolReservesRaw[0]),poolObject.pool.inputTokens[0].decimals)
  let poolLq1 = ethers.utils.formatUnits(String(poolReservesRaw[1]),poolObject.pool.inputTokens[1].decimals)
  if(Number(poolLq0)<20 ||Number(poolLq1)<20){ //TODO:REVIEW THIS IT COULD CAUSE ISSUES WITH FLASH LOANS
    
    return false

  }
  let poolReserves = {
    lq0:  poolLq0,
    lq1:  poolLq1,
    //timestamp??
  }
  
  poolObject.pool.poolReserves = poolReserves
  

  
  //get liquidity for matches and update match -object

  for (const match of poolObject.matches) {
    const matchContract = new ethers.Contract(match.id, v2PairArtifact.abi, provider);
    let matchReservesRaw = await matchContract.getReserves()
    let lq0 =  ethers.utils.formatUnits(String(matchReservesRaw[0]),match.inputTokens[0].decimals)
    let lq1 =  ethers.utils.formatUnits(String(matchReservesRaw[1]),match.inputTokens[1].decimals)
    if(Number(lq0)<20 ||Number(lq1)<20){//TODO:REVIEW THIS IT COULD CAUSE ISSUES WITH FLASH LOANS
      //poolObjects.pop(poolObject)
      console.log("not enough liquidity")
     
      return false
  
    }
    let matchReserves = {
      lq0:  lq0,
      lq1:  lq1,
      lqDiff0:calculatePercentageDiff(poolLq0,lq0) ,
      lqDiff1:calculatePercentageDiff(poolLq1,lq1) ,
      //timestamp??
    }
    match.poolReserves =  matchReserves
    //console.log(matchReserves)
    

  }
  
  return true
  

  //show the difference between each match update poolObject - object

}

async function preCheckLiquidity(arbTestResult,pairObject1,pairObject2) {
  console.log("\n*Checking liquidity before trade...\n")

  const pairContract1 = new ethers.Contract(pairObject1.id, v2PairArtifact.abi, provider);
  const pairContract2 = new ethers.Contract(pairObject2.id, v2PairArtifact.abi, provider);

  let pairReservesRaw1 = await pairContract1.getReserves()
  let pair1Lq0 = ethers.utils.formatUnits(String(pairReservesRaw1[0]),pairObject1.tokenDecimals1) //TODO:WHY?????????????? is it inversed
  let pair1Lq1 = ethers.utils.formatUnits(String(pairReservesRaw1[1]),pairObject1.tokenDecimals0)

  let pairReservesRaw2 = await pairContract2.getReserves()
  let pair2Lq0 = ethers.utils.formatUnits(String(pairReservesRaw2[0]),pairObject2.tokenDecimals1)
  let pair2Lq1 = ethers.utils.formatUnits(String(pairReservesRaw2[1]),pairObject2.tokenDecimals0)

  let liquidityRequiredInit = arbTestResult.outputAmountInit
  let liquidityRequiredExit = arbTestResult.outputAmountExit
  //console.log("arbResult liquidity check",arbTestResult)
  console.log("liquidityRequiredInit",liquidityRequiredInit)
  console.log("liquidityRequiredExit",liquidityRequiredExit)
  console.log("pair1Lq1",pair1Lq1)
  console.log("pair2Lq1",pair2Lq1)
  //19385115.989164363489263255

  if(Number(pair1Lq1)<Number(liquidityRequiredInit)){
    console.log("not enough initial liqiuidity")
    return false
  }if(Number(pair2Lq1)<Number(liquidityRequiredExit)){
    console.log("not enough exit liqiuidity")
    return false
  }else{
    return true
  }
 
  

  //pull liquidity again
}

function checkOwnedDirection(pairObject1,pairObject2) {
  console.log("*Checking owned direction...")

  const ownedTokens = [
    "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
    "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
    "0xc2132d05d31c914a87c6611c10748aeb04b58e8f"
  ];
  let token0Init = pairObject1.token0
  if (!ownedTokens.includes(token0Init)) {
    console.log("flip tokens");
    pairObject1 = {
      id: pairObject1.id,
      token0:  pairObject1.token1, 
      token1: pairObject1.token0, 
      tokenSymbols0:pairObject1.tokenSymbols1,
      tokenSymbols1:pairObject1.tokenSymbols0,
      tokenDecimals0: pairObject1.tokenDecimals1,
      tokenDecimals1: pairObject1.tokenDecimals0,
      exchangeName: pairObject1.exchangeName,
     
    };
    pairObject2 = {
      id: pairObject2.id,
      token0:  pairObject2.token1, 
      token1: pairObject2.token0, 
      tokenSymbols0:pairObject2.tokenSymbols1,
      tokenSymbols1:pairObject2.tokenSymbols0,
      tokenDecimals0: pairObject2.tokenDecimals1,
      tokenDecimals1: pairObject2.tokenDecimals0,
      exchangeName: pairObject2.exchangeName,
     
    };
  }

   let pairObjects =  {pairObject1,pairObject2}
  
   return pairObjects
}

const run = async () => {

  //find and filter the pool data from the subgraph and add it to the file

  // //only run on init - DO not RUN LOOP WITH THIS!!!!

  //read the pool data
  let poolObjects = await readPoolsFromSubgraphtoFile()
  for (const poolObject of poolObjects) {
    try{
    console.log("\nNext pair...")
    console.log(""+poolObject.pool.inputTokens[0].symbol+"->"+poolObject.pool.inputTokens[1].symbol+"... ")
    //check liquidity is reasonable
     let lqResult = await checkLiquidity(poolObject, poolObjects)
     let fileName = ""
     
     if(!lqResult || lqResult===false){
      //poolObjects.pop(poolObject)
      //skip if there isn't enough liquidity do not pop
       continue
     }

     let pairObject1 = {
      id: poolObject.pool.id,
      token0:  poolObject.pool.inputTokens[0].id, 
      token1: poolObject.pool.inputTokens[1].id, 
      tokenSymbols0:poolObject.pool.inputTokens[0].symbol,
      tokenSymbols1:poolObject.pool.inputTokens[1].symbol,
      tokenDecimals0: poolObject.pool.inputTokens[0].decimals,
      tokenDecimals1: poolObject.pool.inputTokens[1].decimals,
      exchangeName: poolObject.pool.exchangeName.toLowerCase(),
     
    };
    let pairObject2 = {
      id: poolObject.matches[0].id,
      token0:  poolObject.matches[0].inputTokens[0].id, 
      token1: poolObject.matches[0].inputTokens[1].id, 
      tokenSymbols0:poolObject.matches[0].inputTokens[0].symbol,
      tokenSymbols1:poolObject.matches[0].inputTokens[1].symbol,
      tokenDecimals0: poolObject.matches[0].inputTokens[0].decimals,
      tokenDecimals1: poolObject.matches[0].inputTokens[1].decimals,
      exchangeName: poolObject.matches[0].exchangeName.toLowerCase(),
     
    };
    let pairObjects = checkOwnedDirection(pairObject1,pairObject2)
    pairObject1 = pairObjects.pairObject1
    pairObject2 = pairObjects.pairObject2

    /**
     * GECKO ARBITRAGE TEST  if it fails continue - skip the madness and save credits 
     */
    console.log("Starting test for "+pairObject1.tokenSymbols0+"->"+pairObject1.tokenSymbols1+"... ")
    console.log("path",[pairObject1.token0,pairObject1.token1])
    //this could be a function tbh
   


    let arbTestResult1 = await arbitrageTest(BUY_AMOUNT,pairObject1,pairObject2)
    console.log("arbTestResult1",arbTestResult1)
    let router0 = setSwapRouterAddress(pairObject1.exchangeName)
    let router1 = setSwapRouterAddress(pairObject2.exchangeName)
    let params1 = {
      token0:pairObject1.token0,
      token1:pairObject1.token1,
      router0:router0,
      router1:router1

    }
    console.log("params1",params1)

    //FLIP!!
    pairObject1.exchangeName = poolObject.matches[0].exchangeName.toLowerCase()
    pairObject2.exchangeName = poolObject.pool.exchangeName.toLowerCase()
    let _router0 = setSwapRouterAddress(pairObject1.exchangeName)
    let _router1 = setSwapRouterAddress(pairObject2.exchangeName)

    let params2 = {
      token0:pairObject1.token0,
      token1:pairObject1.token1,
      router0:_router0,
      router1:_router1

    }
     
     let arbTestResult2 = await arbitrageTest(BUY_AMOUNT,pairObject1,pairObject2)
  
     console.log("arbTestResult2",arbTestResult2)
     console.log("params2",params2)

     if(arbTestResult1.result===false && arbTestResult2.result===false){
        console.log("continue") //NO POINT CHECKING LIQUIDITY IF THEY'RE BOTH FALSE
        continue
     }

     let preCheckLq1 = await preCheckLiquidity(arbTestResult1,pairObject2,pairObject1)
     let preCheckLq2 = await preCheckLiquidity(arbTestResult2,pairObject1,pairObject2)

      console.log("liquidity PreCheck",preCheckLq1,preCheckLq2)
      if(preCheckLq1===false || preCheckLq2===false){
        poolObject.pool.arbSwapResult = {
        "amountOut": null,
        "swapSucceed": false,
        "failReason": "liquidity in pool is too low - no gas spend"
        
    
      }
        await savePoolstoFileTest(poolObject,"./data/arbirtageResultBelowLiquidity"+Date.now()+".json")
        continue
    
      }
      if(arbTestResult1.profit<0 ){
        poolObject.pool.arbSwapResult = {
          "amountOut": arbTestResult1.outputAmountExit,
          "swapSucceed": false,
          "failReason": "negative trade - no gas spend",
          "profit": arbTestResult1.profit,
        
      
        }
        //await savePoolstoFileTest(poolObject,"./data/arbirtageResultNegative"+Date.now()+".json")
        //continue
        
        

        }
        if(arbTestResult2.profit<0 ){
          poolObject.pool.arbSwapResult = {
            "amountOut": arbTestResult2.outputAmountExit,
            "swapSucceed": false,
            "failReason": "negative trade - no gas spend",
            "profit": arbTestResult2.profit,
         
        
          }
          //await savePoolstoFileTest(poolObject,"./data/arbirtageResultNegative"+Date.now()+".json")
          //continue
          
  
          }
      if(arbTestResult1.profit< gasFee && arbTestResult1.profit>0 ){
        poolObject.pool.arbSwapResult = {
          "amountOut": arbTestResult1.outputAmountExit,
          "swapSucceed": false,
          "failReason": "less than profitabletrade - no gas spend",
          "profit": arbTestResult1.profit
          
      
        }
        await savePoolstoFileTest(poolObject,"./data/arbirtageResultBelowGas"+Date.now()+".json")
        //continue
        

        }
        if(arbTestResult2.profit< gasFee && arbTestResult2.profit>0 ){
          poolObject.pool.arbSwapResult = {
            "amountOut": arbTestResult2.outputAmountExit,
            "swapSucceed": false,
            "failReason": "less than profitabletrade - no gas spend",
            "profit": arbTestResult2.profit
        
          }
          await savePoolstoFileTest(poolObject,"./data/arbirtageResultBelowGas"+Date.now()+".json")
          //continue
          
         
  
          }
    

          await savePoolstoFileTest(poolObject,"./data/arbirtageResultPreSwap"+Date.now()+".json")
          
     

    if(arbTestResult1.result===true  && preCheckLq1===true && arbTestResult1.profit>gasFee ){
     console.log("!!Found!!")
     await runFlash(params1)
     let exitThreshold //inputAmountExit- X amount or inputAmountInit

     //TODO:if things break swap pair objects back!!!!!!!!!!!!!!!!!!!!!
     let arbSwapResult1 = await arbitrageSwap(arbTestResult1.inputAmountInit,pairObject2,arbTestResult1.inputAmountExit,pairObject1,arbTestResult1.inputAmountInit)
     poolObject.pool.arbSwapResult1 = arbSwapResult1//runswap
     complete = true
     await savePoolstoFileTest(poolObject,"./data/arbirtageResult"+Date.now()+".json")
     if(arbSwapResult1===true){
      await savePoolstoFileTest(poolObject,"./data/_arbirtageSuccess"+Date.now()+".json")
      
      //return params2

    }
    complete = true
     break
     
    }

     //flip the exchanges
     

    //check liquidity here
    //0x7926ff860c1593e2473f6e28062e5a46230a813c

     
     if(arbTestResult2.result===true && preCheckLq2===true && arbTestResult2.profit>gasFee ){
      console.log("!!Found!!")
      //runswap
      //let arbSwapResult2 = await arbitrageSwap(arbTestResult2.inputAmountInit,pairObject1,arbTestResult2.inputAmountExit,pairObject2,arbTestResult2.inputAmountInit)
      await runFlash(params2) 

      //TODO:pass in the buy amount to run flash
      //https://blog.venly.io/how-to-solve-pending-transactions-on-ethereum-8dd5de6064c0
      //if it fails the first time or takes to long run it again.
      poolObject.pool.arbSwapResult = arbSwapResult2
      await savePoolstoFileTest(poolObject,"./data/arbirtageResult"+Date.now()+".json")
      
      if(arbSwapResult2===true){
        await savePoolstoFileTest(poolObject,"./data/_arbirtageSuccess"+Date.now()+".json")
        

      }
      complete = true

      break
      
     }
     

     
    
    

    }catch(err){
      console.log(err)
      continue
    }
  }

  return null

  //await savePoolstoFileTest(poolObjects,"./data/arbirtageResult"+Date.now()+".json")
  
  
  

}


function waitForMinutes(m) {
  //console.log("timer has passed")
  return new Promise((resolve) => setTimeout(resolve, m * 60 * 1000));
}

async function initialise(){
  //await runFindPools()
 while(!complete){
    await run();
  
    console.log("restarting...")
    await waitForMinutes(5)
  
  }

}


initialise()






