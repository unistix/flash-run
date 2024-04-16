const ethers = require("ethers");
require("dotenv").config();

const fs = require("fs").promises;

const INFURA_URL = process.env.INFURA_URL;
const privateKey = process.env.WALLET_SECRET;
const owner = process.env.WALLET_ADDRESS;

const v2FactoryArtifact = require("./V2ABI.json");
const v2RouterArtifact = require("./V2ROUTER.json");
const v2PairArtifact = require("@uniswap/v2-periphery/build/IUniswapV2Pair.json");
const WMATICABI = require("./WMATICABI.json");

const provider = new ethers.providers.JsonRpcProvider(INFURA_URL);

const _getGasPrice = async () => {
  let gasPrice = await provider.getGasPrice(); /*Create separate function */
  let gasPriceGWEI = ethers.utils.formatUnits(gasPrice, "gwei");
  console.log(`gas price ${gasPriceGWEI.toString()}`);
  //console.log(Math.round((parseInt(Math.round(gasPriceGWEI))*0.30))+ gasPriceGWEI)
  let gasBuffered = Math.round(
    parseInt(gasPriceGWEI) + Math.round(parseInt(gasPriceGWEI) * 0.3),
  ); //increase by 25%
  console.log(`gas price +40% ${gasBuffered.toString()}`);
  return gasBuffered.toString();
};

async function approveTokenSpending(
  tokenAddress,
  decimal,
  amountIn,
  swapRouterAddress,
) {
  const wallet = new ethers.Wallet(privateKey);
  const connectedWallet = wallet.connect(provider);

  const tokenABI = WMATICABI.abi;
  const tokenContract = new ethers.Contract(tokenAddress, tokenABI, wallet);

  let gasPrice = await _getGasPrice();
  const approvalTx = await tokenContract.connect(connectedWallet).approve(
    swapRouterAddress,
    (approvalAmount = amountIn.toString()),
    {
      gasLimit: ethers.utils.hexlify(200000), //this is optimum gas for approval
      gasPrice: ethers.utils.parseUnits(gasPrice, "gwei"),
    },
  ); 
  console.log("approval tx hash",approvalTx.hash);
  await approvalTx.wait();
  console.log(`Approved spending on token ${tokenAddress} for ${owner}`);
  return;
}
const swapToken = async (
  amountIn,
  path,
  decimals,
  exchangeName,
  txType,
  initAmountIn,
  pairObject,
) => {
  console.log(`swapping token ${txType}...`);
  
  const wallet = new ethers.Wallet(privateKey, provider);
  let swapRouterAddress = setSwapRouterAddress(exchangeName);
 
  const swapRouter = new ethers.Contract(
    swapRouterAddress,
    v2RouterArtifact.abi,
    wallet,
  );
  

  const deadline = Math.floor(Date.now() / 1000) + 60 * 5; // 5 minutes
  

  console.log(path);
  const amountsOut = await swapRouter.getAmountsOut(amountIn, path);

  const amountOutMin = amountsOut[amountsOut.length - 1];

  const _amountOut = ethers.utils.formatUnits(
    String(amountOutMin),
    decimals[1],
  );
  const _exitThreshold = ethers.utils.formatUnits(
    String(initAmountIn),
    decimals[1],
  );

  //check amount out and if it's wrong stop and start again
  //skip swap entirely and return  a value
  let swapResultObject = {
    amountOut: _amountOut,
    txHash: null,
    swapSucceed: false, //only if it's above the buy amount on an exit (need enums for buy and sell)
    failReason: null,
  };

  if (txType == "INIT") {
    console.log("checking buy time?...");
    
    console.log("swap result amount out", Number(swapResultObject.amountOut));
    console.log("exit threshold", Number( _exitThreshold));

    if (Number(swapResultObject.amountOut) < Number( _exitThreshold)) {
      swapResultObject.failReason = "Amount in out min less than viable";
      return swapResultObject;
    }
    console.log("swap result amount out", swapResultObject.amountOut);
    console.log("exit threshold", _exitThreshold);
  }

  if (txType == "EXIT") {
    console.log("checking sell time?...");
    console.log("swap result amount out", swapResultObject.amountOut);
    console.log("exit threshold", _exitThreshold);

    if (swapResultObject.amountOut < _exitThreshold) {
      swapResultObject.failReason = "Amount in out min less than viable";
      return swapResultObject;
    }
  }
  await approveTokenSpending(path[0], decimals[0], amountIn, swapRouterAddress);
  
 
  let gasPrice = await _getGasPrice();
  try {
    const tx = await swapRouter.swapExactTokensForTokens(
      amountIn,
      amountOutMin, // , set to 0 for no minimum specified
      path,
      owner,
      deadline,
      {
        gasLimit: ethers.utils.hexlify(200000), //this is optimum gas for approval
        gasPrice: ethers.utils.parseUnits(gasPrice, "gwei"),
      },
    );
    console.log(tx.hash);

    let receipt = await tx.wait(); //returning success or fail from wait would also be good

    if (receipt.status === 1) {
      console.log("Transaction successful!");
      swapResultObject.swapSucceed = true;
      console.log("Transaction Hash:", receipt.transactionHash);
      console.log("Block Number:", receipt.blockNumber);
      swapResultObject.txHash = receipt.transactionHash;

      // Additional information if needed
    } else {
      console.error("Transaction failed!");
      console.log("Transaction Hash:", receipt.transactionHash);
      console.log("Block Number:", receipt.blockNumber);
      swapResultObject.swapSucceed = false;
      swapResultObject.txHash = receipt.transactionHash;
      swapResultObject.failReason = "Swap did not complete";

      // Additional information if needed
    }
  } catch (error) {
    swapResultObject.swapSucceed = false; //use the old tx hash as no reciept
    swapResultObject.failReason = error;
  }

  console.log(amountOutMin);
  console.log(
    "Token1: AMOUNT OUT",
    ethers.utils.formatUnits(String(amountOutMin), decimals[1]),
  );
  
  return swapResultObject;
};

const thresholdCheck = async (txType,_exitThreshold,swapResultObject) => {
 
  if (txType == "INIT") {
    console.log("checking buy time?...");
    console.log("swap result amount out", swapResultObject.amountOut);
    console.log("exit threshold", _exitThreshold);

    if (swapResultObject.amountOut < _exitThreshold) {
      swapResultObject.failReason = "Amount in out min less than viable";
      return swapResultObject;
    }
  }

  if (txType == "EXIT") {
    console.log("checking sell time?...");
    console.log("swap result amount out", swapResultObject.amountOut);
    console.log("exit threshold", _exitThreshold);

    if (swapResultObject.amountOut < _exitThreshold) {
      swapResultObject.failReason = "Amount in out min less than viable";
      return swapResultObject;
    }
  }
  return swapResultObject;

}

const setSwapRouterAddress = (exchangeName) => {
  const routers = [
    {
      exchangeName: "quickswap",
      id: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
    },
    {
      exchangeName: "sushiswap",
      id: "0x1b02da8cb0d097eb8d57a175b88c7d8b47997506",
    },
    {
      exchangeName: "apeswap",
      id: "0xc0788a3ad43d79aa53b09c2eacc313a787d1d607",
    },
    {
      exchangeName: "honeywap",
      id: "0xaD340d0CD0B117B0140671E7cB39770e7675C848",
    },
  ];

  const router = routers.find((router) => router.exchangeName === exchangeName);

  if (router) {
    return router.id;
  } else {
    console.error(`Exchange name "${exchangeName}" not found.`);
    return null;
  }
};

const buyNewToken = async (
  token0AmountIn,
  pairObject,
  exchangeName,
  _threshold,
) => {
  //setSwapRouter
  console.log(_threshold);
  const amountIn = ethers.utils.parseUnits(
    token0AmountIn.toString(),
    pairObject.tokenDecimals0,
  ); // Example: 1 MATIC
  const path = [pairObject.token0, pairObject.token1];
  const decimals = [pairObject.tokenDecimals0, pairObject.tokenDecimals1];
  const threshold = ethers.utils.parseUnits(
    _threshold.toString(),
    pairObject.tokenDecimals1,
  );

  let swapResult = await swapToken(
    amountIn,
    path,
    decimals,
    exchangeName,
    "INIT",
    threshold,
    pairObject,
  );
  //console.log(swapResult.amountOut)
  return swapResult;
};
const sellNewToken = async (
  token1AmountIn,
  pairObject,
  exchangeName,
  _threshold,
) => {
  console.log("calling sell new token");
  //setSwapRouter

  //const amountIn  = ethers.utils.parseUnits(token1AmountIn.toString(), 'ether'); // Example: 1 MATIC
  //don't need to parse already big number
  const amountIn = ethers.utils.parseUnits(
    token1AmountIn.toString(),
    pairObject.tokenDecimals1,
  ); // Example: 1 MATIC
  //const amountIn = token1AmountIn
  const path = [pairObject.token1, pairObject.token0];
  const decimals = [pairObject.tokenDecimals1, pairObject.tokenDecimals0];
  console.log("debug 1");
  console.log(_threshold);
  const threshold = ethers.utils.parseUnits(
    _threshold.toString(),
    pairObject.tokenDecimals0,
  );

  let swapResult = await swapToken(
    amountIn,
    path,
    decimals,
    exchangeName,
    "EXIT",
    threshold,
    pairObject,
  );
  console.log(swapResult.amountOut);

  return swapResult;
  //wait 20 minutes or poll
};


const buyToken = async (
  token0AmountIn,
  pairObject,
  exchangeName,
  _threshold,
 
) => {
  //setSwapRouter
  let path = [pairObject.token0, pairObject.token1];
  let decimals = [pairObject.tokenDecimals0, pairObject.tokenDecimals1];
  

  console.log(_threshold);
  const amountIn = ethers.utils.parseUnits(
    token0AmountIn.toString(),
    decimals[0],
  ); // Example: 1 MATIC
  
  const threshold = ethers.utils.parseUnits(
    _threshold.toString(),
    decimals[1],
  );

  let swapResult = await swapToken(
    amountIn,
    path,
    decimals,
    exchangeName,
    "INIT",
    threshold,
    pairObject,
  );
  //console.log(swapResult.amountOut)
  return swapResult;
};

const getCurrentPrice = async(
  pairObject,
  exchangeName,inv) =>{

  let path = [pairObject.token0, pairObject.token1];
  let decimals = [pairObject.tokenDecimals0, pairObject.tokenDecimals1];
  let symbols = [pairObject.tokenSymbols0, pairObject.tokenSymbols1]

  /*if(inv){
    path = [pairObject.token1, pairObject.token0];
    decimals = [pairObject.tokenDecimals1, pairObject.tokenDecimals0];
    symbols = [pairObject.tokenSymbols1, pairObject.tokenSymbols0]
  }*/
  
  const amountIn = ethers.utils.parseUnits(
      "1", //token 0 will always be 1.
      decimals[0],
  ); // Example: 1 MATIC
  
  

  console.log(`getting current price ${symbols} - ${pairObject.exchangeName}...`);
  
  const wallet = new ethers.Wallet(privateKey, provider);
  let swapRouterAddress = setSwapRouterAddress(exchangeName);
 
  const swapRouter = new ethers.Contract(
    swapRouterAddress,
    v2RouterArtifact.abi,
    wallet,
  );

  const amountsOut = await swapRouter.getAmountsOut(amountIn, path);

  const amountOutMin = amountsOut[amountsOut.length - 1];

  const _amountOut = ethers.utils.formatUnits(
    String(amountOutMin),
    decimals[1],)

  //console.log(`token 0: ${1} token 1: ${_amountOut}`)
  return(_amountOut)

}



module.exports = {
  buyNewToken,
  sellNewToken,
  getCurrentPrice
};
