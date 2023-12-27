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


  const getAllPoolData = async (excName,subgraphUrl) => {
    /*This might need refactoring */
    let skipNo = 0 
    let timeExit = true //time exit is true of lpool.createdTimestamp = today
    let allPoolNames = []
    while (timeExit){
        let poolsRaw
        try{
            poolsRaw = await getPoolDataFromSubgraph(skipNo, subgraphUrl,excName)
            //poolsRaw = addExcName(poolsRaw,excName)
            /*
            * This is where you add excName and factory data!!!
            * Something is messing with skip number
            */
        }catch(err){
            console.log(skipNo, `Can not get pool data from ${excName} `)
            console.log(err)
            poolsRaw = [] //set it to empty and skip i dunno
        }
      
      for (let i = 0; i < poolsRaw.length; i++) {
        //let _name = poolsRaw[i].name.replace(excName,"")
        //console.log(poolsRaw[i])
        allPoolNames.push(poolsRaw[i])

        //Don't bother replacing the name you can search on the token ids 

      }
     skipNo = skipNo + poolsRaw.length
      if (skipNo + poolsRaw.length ==  skipNo){
        timeExit = false
      }

    }
    console.log(`Got all data from ${excName}`);
    return(allPoolNames)
}

const addExcName = (pools, excName) => {
  /**
   * Helps finding factories later - there might be a better place to add this but it's going here
   */
  for (let i = 0; i < pools.length; i++) {
    //console.log(pools[i])
    pools[i].excName = excName
    
  }
  return pools
}

const addFactory = (pools) => {
  

  /**
   * Helps finding factories later - there might be a better place to add this but it's going here
   */
  for (let i = 0; i < pools.length; i++) {
    
    factory = factories.factories.find(factory => factory.excName === pools[i].excName);
  
    
    //pools[i].factory = excName
    pools[i].factory = factory.routerId
    //console.log(pools[i])
    
    
  }
  return pools
}


const getPoolDataFromSubgraph = async (skipNo , subgraphUrl, excName) => {
    const URL = subgraphUrl
    
      //skip is going to be the value that allows you to iterate

      //TODO:only MATIC for now with WHERE id should probably be passed in and paired with the token being borrowed in the smart contract
      query = `
      {
        liquidityPools (
          first: 100
          skip: ${skipNo} 
          where: {inputTokens_: {id: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270"}} 
        ) {
            id
            name
            inputTokens {
              id
              decimals
              symbol
            }
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
                pools = addExcName(pools,excName)
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

  fs.writeFileSync('../data/newpools.json', jsonContent, 'utf8');
  console.log('JSON file has been written');


}
  

exports.runFindPools = async () => {
    console.log("running find pools")
    let allPoolNames
    
    //TODO:this should be a for loop through sugraphs list tbh 
    let sushiPools = await getAllPoolData(subgraphs.subgraphs[0].name,subgraphs.subgraphs[0].url)
    //sushiPools = await addExcName(sushiPools,"SushiSwap")
    let apePools = await getAllPoolData(subgraphs.subgraphs[3].name,subgraphs.subgraphs[3].url)
    let honeyPools = await getAllPoolData(subgraphs.subgraphs[2].name,subgraphs.subgraphs[2].url)
    let quickPools = await getAllPoolData(subgraphs.subgraphs[1].name,subgraphs.subgraphs[1].url)
    console.log(quickPools)
    //console.log(sushiPools[0])
    //console.log(apePools[0])

    allPoolNames = [...sushiPools,...apePools,...honeyPools,...quickPools]

    let matchingPools = findMatchingPools(allPoolNames)

    await saveMatchingPools(matchingPools)


    return matchingPools
}
