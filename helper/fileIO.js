const fs = require("fs").promises;
const { error } = require('console')

async function readPoolsFromSubgraphtoFile() { //TODO:name is confusing should be read Pools from File
    try {
      // Read the currentTrade.json file
      const poolsRaw = await  fs.readFile("./data/filteredPools.json", "utf-8");
      const poolsData = JSON.parse(poolsRaw);
  
      // Parse the JSON data
      
      return poolsData;
    } catch (error) {
      if (error.code === "ENOENT") {
        // File doesn't exist, return null
        console.error( "file doesnt exist:",error.message);
        return null;
      } else {
        // Handle other errors
        console.error( error.message);
        throw error;
        return null;
      }
    }
  }

const savePoolstoFileTest = async (poolObjects,filename) => {
    const jsonContent = JSON.stringify(poolObjects, null, 2);
  
    await fs.writeFile(filename, jsonContent, 'utf8');
    console.log('JSON file has been written');
  
  
  }


module.exports = {
    readPoolsFromSubgraphtoFile,
    savePoolstoFileTest
}