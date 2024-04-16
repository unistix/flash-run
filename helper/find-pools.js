const subgraphs = require('../data/subgraphs.json')
const factories = require('../data/factories.json')
//get the pools from the subgraphs and all relevant data 
//only ones with MATIC (later you can borrow others)
//https://www.youtube.com/watch?v=7GJJxnneer8


const axios = require('axios')
const ethers = require('ethers');
const fs = require('fs');
const { error } = require('console')

require('dotenv').config()
const ETHERSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY
const INFURA_URL = process.env.MAINNET_URL


  const getAllPoolData = async (exchangeName,subgraphUrl) => {
    /*This might need refactoring */
    let skipNo = 0 
    let timeExit = true //time exit is true of lpool.createdTimestamp = today
    let allPoolNames = []
    while (timeExit){
        let poolsRaw
        try{
            poolsRaw = await getPoolDataFromSubgraph(skipNo, subgraphUrl,exchangeName)
            //poolsRaw = addexchangeName(poolsRaw,exchangeName)
            /*
            * This is where you add exchangeName and factory data!!!
            * Something is messing with skip number
            */
        }catch(err){
            console.log(skipNo, `Can not get pool data from ${exchangeName} `)
            console.log(err)
            poolsRaw = [] //set it to empty and skip i dunno
        }
      
      for (let i = 0; i < poolsRaw.length; i++) {
        //let _name = poolsRaw[i].name.replace(exchangeName,"")
        //console.log(poolsRaw[i])
        allPoolNames.push(poolsRaw[i])

        //Don't bother replacing the name you can search on the token ids 

      }
     skipNo = skipNo + poolsRaw.length
      if (skipNo + poolsRaw.length ==  skipNo){
        timeExit = false
      }

    }
    console.log(`Got all data from ${exchangeName}`);
    return(allPoolNames)
}

const addexchangeName = (pools, exchangeName) => {
  /**
   * Helps finding factories later - there might be a better place to add this but it's going here
   */
  for (let i = 0; i < pools.length; i++) {
    //console.log(pools[i])
    pools[i].exchangeName = exchangeName
    
  }
  return pools
}

const addFactory = (pools) => {
  

  /**
   * Helps finding factories later - there might be a better place to add this but it's going here
   */
  for (let i = 0; i < pools.length; i++) {
    
    factory = factories.factories.find(factory => factory.exchangeName === pools[i].exchangeName);
  
    
    //pools[i].factory = exchangeName
    pools[i].factory = factory.id
    //console.log(pools[i])
    
    
  }
  return pools
}


const getPoolDataFromSubgraph = async (skipNo , subgraphUrl, exchangeName) => {
    const URL = subgraphUrl
    
      //skip is going to be the value that allows you to iterate

      //TODO: change to 100 for hster runs
      query = `
      {
        liquidityPools (
          orderBy: totalValueLockedUSD
          orderDirection: desc,
          first: 100
          skip: ${skipNo} 
          where: {totalValueLockedUSD_gt: "20"}
           
        ) {
            id
            name
            inputTokens {
              id
              decimals
              symbol
            }
            totalValueLockedUSD
        }
      }
      
      `
      //, cumulativeVolumeUSD_gt: "10000" breaks quickswap for some reason

      //output token supply is active liquidity and output token price is avialable
      //loop through and just get all the pools
      // you can check ape swap back for prices afterwards too.
      
        await axios.post(URL, {query: query})
        .then((result) =>{
                pools =  result.data.data.liquidityPools
                pools = addexchangeName(pools,exchangeName)
                pools = addFactory(pools)
                //console.log(result.data.data.liquidityPools)
                
           
        })
    
      
      return pools
}

function findMatchingPools(poolObjects) {
    const matchingPools = [];
  
    for (let i = 0; i < poolObjects.length; i++) {
      const currentPool = poolObjects[i];
      const currentTokenIds = currentPool.inputTokens.map(token => token.id);
  
      const matches = poolObjects.filter(poolObj =>
        poolObj.id !== currentPool.id &&
        poolObj.inputTokens.every(token => currentTokenIds.includes(token.id))
      );
  
      if (matches.length > 0) {
        matchingPools.push({ pool: currentPool, matches });
      }
    }
    console.log('Matching pools');
    return matchingPools;
}

const saveMatchingPools = async (poolObjects) => {
  const jsonContent = JSON.stringify(poolObjects, null, 2);

  fs.writeFileSync('./data/filteredPools.json', jsonContent, 'utf8'); //./data/filteredPools.json
  console.log('JSON file has been written');


}

function filterPoolObjects(poolObjects) {
  const filteredObjects = [];
  const ownedTokens = [
    "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
    "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
    "0xc2132d05d31c914a87c6611c10748aeb04b58e8f"
  ];
  const bannedTokens =[
    "0x7b3bd12675c6b9d6993eb81283cb68e6eb9260b5",//CTF - fees on trade for token - also can't sell all
    "0x840b5fc8c6dee2b1140174a3abdc215190426ccf",//Can't buy - may wierd things on contract
    "0x8e677ca17065ed74675bc27bcabadb7eef10a292", //RAIN it won't balance out
    "0x23e8b6a3f6891254988b84da3738d2bfe5e703b9", //WELT it's wierd
  ]//TODO: SOLVE THIS!!!

  for (const poolObject of poolObjects) {
    
    console.log("pool",poolObject)
    if (bannedTokens.includes(poolObject.pool.inputTokens[0].id)||
        bannedTokens.includes(poolObject.pool.inputTokens[1].id)){
          continue
          //skip if the token is in the banned list

    }
    //total value greater than 50
      if (ownedTokens.includes(poolObject.pool.inputTokens[0].id) ||
          ownedTokens.includes(poolObject.pool.inputTokens[1].id)) {
          filteredObjects.push(poolObject);
      } else {
          for (const match of poolObject.matches) {
              if (ownedTokens.includes(match.inputTokens[0].id) ||
                  ownedTokens.includes(match.inputTokens[1].id)) {
                  filteredObjects.push(poolObject);
                  break; // Stop further iteration if condition met
              }
          }
      }
  }

  return filteredObjects;
}
  

exports.runFindPools = async () => {
    console.log("running find pools")
    let allPoolNames
    
    //TODO:this should be a for loop through sugraphs list tbh 
    let quickPools = await getAllPoolData(subgraphs.subgraphs[1].name,subgraphs.subgraphs[1].url)
    let sushiPools = await getAllPoolData(subgraphs.subgraphs[0].name,subgraphs.subgraphs[0].url)
    //sushiPools = await addexchangeName(sushiPools,"SushiSwap")
    let apePools = await getAllPoolData(subgraphs.subgraphs[3].name,subgraphs.subgraphs[3].url)
    //let honeyPools = await getAllPoolData(subgraphs.subgraphs[2].name,subgraphs.subgraphs[2].url)
    
    
    //console.log(sushiPools[0])
    //console.log(apePools[0])

    allPoolNames = [...sushiPools,...quickPools,...apePools]//TODO:remember honey removed

    let matchingPools = findMatchingPools(allPoolNames)

    let filteredPools = filterPoolObjects(matchingPools)

    //filter matching pools here
    //MATIC/USDT/USDC

    await saveMatchingPools(filteredPools)


    return matchingPools
}
