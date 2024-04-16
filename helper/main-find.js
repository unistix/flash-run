const findPools = require("./find-pools.js")
//nothing outside const except imports 
const main = async () => {
    

    console.log("running find pools")
    await findPools.runFindPools().then((runFindPoolsResult) => {
        
        console.log(runFindPoolsResult.length)
        console.log(runFindPoolsResult.slice(-5,-1))
        //console.log(runFindPoolsResult[0].inputTokens)
    })
    //console.log(await runFindPoolsResult)
}

main()