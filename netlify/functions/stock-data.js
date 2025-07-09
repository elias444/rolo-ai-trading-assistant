// netlify/functions/stock-data.js
// Handles fetching real-time stock data from Alpha Vantage

const fetch = require('node-fetch'); // Required for making HTTP requests in Node.js

exports.handler = async (event, context) => {
  // Set CORS headers to allow requests from your frontend
  const headers = {
    'Access-Control-Allow-Origin': '*', // Allow requests from any origin (your Netlify frontend)
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS' // Allow GET and OPTIONS methods
  };

  // Handle preflight OPTIONS requests (required by CORS)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Ensure it's a GET request
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed', message: 'Only GET requests are supported.' })
    };
  }

  // Extract symbol from query parameters
  const symbol = event.queryStringParameters?.symbol;

  if (!symbol) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Bad Request', message: 'Stock symbol parameter is required.' })
    };
  }

  try {
    // Get Alpha Vantage API key from environment variables (Netlify)
    const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

    if (!ALPHA_VANTAGE_API_KEY) {
      console.error('ALPHA_VANTAGE_API_KEY is not set in environment variables.');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server Error', message: 'API key not configured.' })
      };
    }

    // Alpha Vantage API URL for GLOBAL_QUOTE (real-time data)
    // Note: Using entitlement=realtime for live data, based on your previous files.
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&entitlement=realtime&apikey=${ALPHA_VANTAGE_API_KEY}`;

    console.log(`[stock-data.js] Fetching data for ${symbol} from Alpha Vantage...`);

    const response = await fetch(url);

    if (!response.ok) {
      // Handle HTTP errors from Alpha Vantage
      const errorText = await response.text();
      console.error(`[stock-data.js] Alpha Vantage HTTP error for ${symbol}: ${response.status} - ${errorText}`);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: 'Alpha Vantage API Error', message: `Failed to fetch data for ${symbol}. Status: ${response.status}` })
      };
    }

    const data = await response.json();

    // Check for Alpha Vantage specific error messages
    if (data['Error Message']) {
      console.error(`[stock-data.js] Alpha Vantage Error Message for ${symbol}: ${data['Error Message']}`);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'API Error', message: data['Error Message'] })
      };
    }
    if (data['Note'] && data['Note'].includes('API call frequency')) {
      console.warn(`[stock-data.js] Alpha Vantage API rate limit hit for ${symbol}.`);
      return {
        statusCode: 429, // Too Many Requests
        headers,
        body: JSON.stringify({ error: 'Rate Limit Exceeded', message: 'Alpha Vantage API call frequency limit reached. Please try again in a minute.' })
      };
    }

    const quote = data['Global Quote'];
    if (!quote || !quote['05. price']) {
      console.warn(`[stock-data.js] No quote data found for ${symbol}. Response:`, data);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Not Found', message: `No real-time data available for ${symbol}. Please check the symbol.` })
      };
    }

    // Parse and format the data
    const stockData = {
      symbol: symbol.toUpperCase(),
      price: parseFloat(quote['05. price']).toFixed(2),
      change: parseFloat(quote['09. change']).toFixed(2),
      changePercent: parseFloat(quote['10. change percent']).toFixed(2) + '%',
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

    console.log(`[stock-data.js] Successfully fetched data for ${symbol}: $${stockData.price}`);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(stockData)
    };

  } catch (error) {
    console.error(`[stock-data.js] Uncaught error fetching data for ${symbol}:`, error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal Server Error', message: `An unexpected error occurred: ${error.message}` })
    };
  }
};