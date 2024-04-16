const axios = require("axios");
const geckoAPI = 'https://api.geckoterminal.com/api/v2/networks/polygon_pos/pools/'

//were goona need a lot more data but this is a good place to start tbh

const getLastXHours = async (poolAddress,hour,direction) => {
  /**
   * Get the current approx price
   */
  let priceData;
  let limit = hour*60
  const apiUrl = `${geckoAPI}${poolAddress}/ohlcv/minute?aggregate=1&limit=${limit}&currency=token&token=${direction}`;

  try {
    const response = await axios.get(apiUrl);
    const data = response.data;

    if (data.data.attributes.ohlcv_list.length === 0) {
      ///TODO:check length isn't 0
      priceData = null;
      return priceData;
    } else {
      priceData = data.data.attributes.ohlcv_list;
    }

    return priceData;
  } catch (error) {
    console.error("Error fetching data:", error.message);
    throw error;
  }
};

/**
 * Get 1 each day interval for all time 
 * before timestamp will be the most useful here
 */

const getPriceData = async (poolAddress,timeframe,aggregate,direction,timestamp) => {

  let limit = 1000
  let priceData = null
  let apiUrl 
  if(timestamp===null){
    apiUrl = `${geckoAPI}${poolAddress}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}&currency=token&token=${direction}`;

  }else{
  
    apiUrl = `${geckoAPI}${poolAddress}/ohlcv/${timeframe}?aggregate=${aggregate}&before_timestamp=${timestamp}&limit=${limit}&currency=token&token=${direction}`;

  }
 
  //&before_timestamp=1679414400 (after aggregate)

  try {
    const response = await axios.get(apiUrl);
    const data = response.data;

    if (data.data.attributes.ohlcv_list.length === 0) {
      ///TODO:check length isn't 0
      priceData = null;
      return priceData;
    } else {
      priceData = data.data.attributes.ohlcv_list;
    }

    return priceData;
  } catch (error) {
    console.error("Error fetching data:",error);
    throw error
    return priceData;
    //throw error;
  }
};

const getCurrentPrice = async(poolAddress,direction) =>{
  result = getPriceData(poolAddress,"minute",1,direction,null)
  return result[0][4]
}

const geckoArbitrageTest = async(BUY_AMOUNT,pairAddress1,pairAddress2) =>{
  //you need to determine whether it's base or quote required too

}

module.exports = {
  getLastXHours,
  getPriceData,
  getCurrentPrice
};