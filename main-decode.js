const ethers = require('ethers')
require('dotenv').config()
const pools = require('./data/pools.json')
const axios = require('axios')
const fs = require('fs').promises;

const INFURA_URL = process.env.INFURA_URL
const INFURA_WEBSOCKET = process.env.INFURA_WEBSOCKET
const privateKey = process.env.WALLET_SECRET

const v3PoolArtifact = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json")
const v2PairArtifact = require('@uniswap/v2-periphery/build/IUniswapV2Pair.json')
const v2RouterArtifact = require('./artifacts/V2ROUTER.json')
const WMATICABI = require('./artifacts/WMATICABI.json')
const FlashLoanExampleABI = require('./artifacts/FlashLoanSwapTest.json')

const owner = "0x0040DEf8786BE2f596E9b74d50Ae3eC4A3bFa446"
const flashLoanContractAdress = "0xb873d1C35CF639552c36670c277389d665944867"
const contractInterface = new ethers.utils.Interface(v2RouterArtifact.abi); //interface object - decodes data in trasnaction 
const socketProvider = new ethers.providers.WebSocketProvider(INFURA_WEBSOCKET)
const provider = new ethers.providers.JsonRpcProvider(INFURA_URL)


txcount = 0
stoplisten = false





const main = async () => {
  //listen to pending transaction
  //pending returns only the hash and we need to get the actual tx data
  console.log("listening for pending data")
  
  socketProvider.on('pending', pendingListener);
  
  
};

const pendingListener = async (hash) => {
  if(!stoplisten){
    
    await getTransaction(hash);
    
    stoplisten=true
    socketProvider.removeListener('pending', pendingListener);
    console.log('Stopped listening to pending events.');

    await delay(2000)
    txcount=0
    stoplisten=false
    socketProvider.on('pending', pendingListener); //recursive???
  }
   
}





const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const V2_ADDRESSES = [
  '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', //quickswao
  '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506', //sushiswap
  '0xC0788A3aD43d79aa53B09c2EaCc313A787d1d607', //apeswap
  '0xaD340d0CD0B117B0140671E7cB39770e7675C848', //honeyswap
   //Quickswap V2
    //'0xE592427A0AEce92De3Edee1F18E0157C05861564', Uniswap V3
]

const V3_ADDRESSES = [
  '0xE592427A0AEce92De3Edee1F18E0157C05861564', //uniswap
  '0xf5b509bB0909a69B1c207E495f687a596C168E12', //quickswap
  '0x46B3fDF7b5CDe91Ac049936bF0bDb12c5d22202e', //sushiswap
   //Quickswap V2
    //'0xE592427A0AEce92De3Edee1F18E0157C05861564', Uniswap V3
]



let txIdx = 0
const getTransaction = async (transactionHash) => {
  stoplisten=true
  socketProvider.removeListener('pending', pendingListener);
  
  //make 3 attempts to get the tx from the hash
  for (let i = 0; i < 2; i++) {
        const tx = await socketProvider.getTransaction(transactionHash);
        if (tx) { //if there is a transaction check the to value for a match on this list of contract addresses only contained in the swap router address
          console.log(transactionHash);
          console.log(tx.to)
            if (V2_ADDRESSES.includes(tx.to)) { //if the current pending TX is included
              console.log("V2 found")
                txIdx += 1
                const data = tx.data //get the encoded string which contains all relevant swap data 
                decodeTransaction(data, txIdx, transactionHash)
                //write the transaction hash and tx.to if it's found
                break
            }

            if (V3_ADDRESSES.includes(tx.to)) { //if the current pending TX is included
              console.log("V3 found")
              const logData = {
                txHash: transactionHash,
                txTo: tx.to,}
              
              logToJSONAndFile(logData,'transactionLogsV3.json');
                txIdx += 1
                const data = tx.data //get the encoded string which contains all relevant swap data 
                //write the transaction hash and tx.to if it's found
                //decodeTransaction(data, txIdx, transactionHash)
                break
            }
        }
        await delay(2000); //wait one second between each event
    
    }
}

const decodeTransaction = async (txInput, txIdx, transactionHash,isMulticall = false) => {
  console.log("decoding get tx...")

  const decodedData = contractInterface.parseTransaction({ data: txInput });

  const functionName = decodedData.name;

  const args = decodedData.args;
  console.log(decodedData)

  path = args[2]
  pathObject =  {
    inputToken: path[0],
    outputToken:path[-1],
    inputDecimals: await getDecimals(path[0]),
    outputDecimals: await getDecimals(path[-1])
  }
  //get the demicals
  //figure out amount in and amountOut
  //use decimals to create amountIn and amountOutMin

  
  const params = {
    functionName: decodedData.name,
    amountIn: ethers.utils.formatUnits(String(args[0]),pathObject.inputDecimals)  ,//params.amountIn,
    amountOutMin:ethers.utils.formatUnits(String(args[1]),pathObject.outputDecimals),
    path: args[2],
    to: args[3],
    deadline: args[4],
    dData:decodedData
    
  }

  const params2 ={
    functionName: decodedData.name,
    dData:decodedData

  }
  //const data = args.data;


  //logFunctionName(functionName, txIdx, isMulticall);

  if (functionName === 'swapExactTokensForTokens') { return logSwapExactTokensForTokens(params, transactionHash) }

  if (functionName === 'swapTokensForExactTokens') { return logSwapExactTokensForTokens(params2, transactionHash) }
  if (functionName === 'swapExactETHForTokens') { return logSwapExactTokensForTokens(params2, transactionHash) }
  if (functionName === 'swapTokensForExactETH') { return logSwapExactTokensForTokens(params2, transactionHash) }
  if (functionName === 'swapExactTokensForETH') { return logSwapExactTokensForTokens(params2, transactionHash) }
  if (functionName === 'swapETHForExactTokens') { return logSwapExactTokensForTokens(params2, transactionHash) }
  if (functionName === 'swapExactTokensForTokensSupportingFeeOnTransferTokens') { return logSwapExactTokensForTokens(params2, transactionHash) }
  if (functionName === 'swapExactETHForTokensSupportingFeeOnTransferTokens') { return logSwapExactTokensForTokens(params2, transactionHash) }
  if (functionName === 'swapExactTokensForETHSupportingFeeOnTransferTokens') { return logSwapExactTokensForTokens(params2, transactionHash) }
  if (functionName === 'swapExactTokensForETHSupportingFeeOnTransferTokens') { return logSwapExactTokensForTokens(params2, transactionHash) }
  /**
   * use inclusion list this iss too long...
   */
  // Add more functions as needed for V2

  console.log('ADD THIS FUNCTION:', functionName);
  console.log('decodedData:', decodedData);
}


// Add more log functions for different Uniswap V2 functions
const logToJSONAndFile = async (logData,file) => {
  try {
    let dataList = [];

    // Check if the file exists
    try {
      const fileData = await fs.readFile('transactionLogs.json', 'utf-8');
      dataList = JSON.parse(fileData);
    } catch (err) {
      // File doesn't exist, create an empty list
      dataList = [];
    }

    // Append the new log data to the list
    dataList.push(logData);

    // Write the updated list back to the file
    await fs.writeFile(file, JSON.stringify(dataList, null, 2), 'utf-8');

    console.log('Log data written to transactionLogs.json successfully.');
  } catch (error) {
    console.error('Error writing log data to file:', error);
    stoplisten=true
    socketProvider.removeListener('pending', pendingListener);
  }
};

const logSwapExactTokensForTokens = (params, transactionHash) => {

  const logData = {
    hash: transactionHash,
    params: params,
    date: Date.now(),
  };
  console.log('amountIn:         ', params.amountIn);
  console.log('amountOutMin:     ', params.amountOutMin);
  console.log('path:             ', params.path);
  console.log('to:               ', params.to);
  console.log('deadline:         ', params.deadline);
  console.log(params)

  logToJSONAndFile(logData,'transactionLogsV2.json');

  //return which exchange and other relevant data 
}

// Add more log functions for different Uniswap V2 functions

// Rest of the code remains unchanged

const getDecimals = async (tokenAddress) => {
  try {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function decimals() view returns (uint8)'],
      provider
    );

    const decimals = await tokenContract.decimals();
    console.log(`Decimals for token at address ${tokenAddress}: ${decimals}`);
    return decimals;
  } catch (error) {
    console.error('Error getting decimals:', error);
    throw error; // You may want to handle or propagate the error based on your application's needs
  }
};

main();













