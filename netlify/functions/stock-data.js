// netlify/functions/stock-data.js
// This Netlify Function fetches real-time stock data from Alpha Vantage

exports.handler = async (event, context) => {
  // CORS headers for security and allowing your frontend to access this function
  const headers = {
    'Access-Control-Allow-Origin': '*', // Allows requests from any domain
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS', // Allow GET requests and pre-flight OPTIONS requests
    'Content-Type': 'application/json'
  };

  // Handle pre-flight OPTIONS requests (required by CORS)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Get the stock symbol from the URL query parameters (e.g., ?symbol=AAPL)
  const symbol = event.queryStringParameters?.symbol;
  
  // Return an error if no symbol is provided
  if (!symbol) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        error: 'Symbol parameter is required (e.g., /.netlify/functions/stock-data?symbol=AAPL)'
      })
    };
  }

  try {
    console.log(`[stock-data.js] Fetching data for ${symbol}...`);
    
    // Retrieve your Alpha Vantage API key from Netlify environment variables
    const API_KEY = process.env.ALPHA_VANTAGE_API_KEY; 

    // Return an error if the API key is not set
    if (!API_KEY) {
        console.error("[stock-data.js] ALPHA_VANTAGE_API_KEY environment variable is not set.");
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Alpha Vantage API key is not configured in Netlify environment variables.',
                details: 'Please set ALPHA_VANTAGE_API_KEY in your Netlify site settings > Environment variables.'
            })
        };
    }
    
    // Construct the Alpha Vantage API URL for GLOBAL_QUOTE with 'realtime' entitlement
    // This is the specific format that has worked for your premium account.
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&entitlement=realtime&apikey=${API_KEY}`;
    
    console.log(`[stock-data.js] Calling Alpha Vantage for ${symbol} with URL: ${url.replace(API_KEY, 'YOUR_API_KEY')}`); // Log URL safely without exposing key
    
    // Make the API request to Alpha Vantage
    const response = await fetch(url);
    
    // Throw an error if the HTTP response status is not OK (e.g., 404, 500)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} from Alpha Vantage`);
    }
    
    const data = await response.json();
    
    // Handle Alpha Vantage specific error messages returned in the JSON body
    if (data['Error Message']) {
      console.error(`[stock-data.js] Alpha Vantage Error for ${symbol}: ${data['Error Message']}`);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: `Alpha Vantage API error: ${data['Error Message']}. Please check your API key and entitlement.`,
          details: data
        })
      };
    }
    
    // Handle Alpha Vantage rate limit note
    if (data['Note']) {
      console.warn(`[stock-data.js] Alpha Vantage Note for ${symbol}: ${data['Note']}`);
      return {
        statusCode: 429, // 429 Too Many Requests
        headers,
        body: JSON.stringify({ 
          error: `Alpha Vantage API rate limit reached. ${data['Note']} Please try again in a moment.`,
          details: data
        })
      };
    }
    
    // Extract the 'Global Quote' data
    const quote = data['Global Quote'];
    if (!quote || !quote['05. price']) {
      // If no quote data or price, it might be an invalid symbol or no data available
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: `No price data available for ${symbol}. This might happen for delisted or invalid symbols.`,
          details: data // Include full data for debugging
        })
      };
    }

    // Format the stock data to be returned to the frontend
    const stockData = {
      symbol: symbol.toUpperCase(),
      price: parseFloat(quote['05. price']).toFixed(2),
      change: parseFloat(quote['09. change']).toFixed(2),
      changePercent: quote['10. change percent'],
      volume: parseInt(quote['06. volume']).toLocaleString(),
      high: parseFloat(quote['03. high']).toFixed(2),
      low: parseFloat(quote['04. low']).toFixed(2),
      open: parseFloat(quote['02. open']).toFixed(2),
      previousClose: parseFloat(quote['08. previous close']).toFixed(2),
      lastUpdated: quote['07. latest trading day'],
      timestamp: new Date().toISOString(),
      source: 'Alpha Vantage Real-Time',
      isRealTime: true
    };

    console.log(`[stock-data.js] Success: ${symbol} = $${stockData.price}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(stockData)
    };

  } catch (error) {
    console.error(`[stock-data.js] Unexpected server error for ${symbol}:`, error);
    
    // Generic error response for unexpected issues
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: `An unexpected server error occurred: ${error.message}. Please check Netlify function logs for more details.`,
        details: error.message
      })
    };
  }
};
