// netlify/functions/stock-search.js
// Search for stocks by symbol or name

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const query = event.queryStringParameters?.query;
    
    if (!query || query.length < 2) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Query must be at least 2 characters long',
          results: []
        })
      };
    }
    
    console.log(`[stock-search.js] Searching for: ${query}`);
    
    const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
    
    if (!API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Alpha Vantage API key not configured',
          results: []
        })
      };
    }
    
    // Use Alpha Vantage's Symbol Search endpoint
    const searchUrl = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${API_KEY}`;
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          error: `Alpha Vantage API error: ${response.statusText}`,
          results: []
        })
      };
    }
    
    const data = await response.json();
    
    if (!data.bestMatches) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          message: 'No matches found',
          results: []
        })
      };
    }
    
    // Format search results
    const results = data.bestMatches
      .filter(match => match['4. region'] === 'United States') // Filter to US markets for now
      .map(match => ({
        symbol: match['1. symbol'],
        name: match['2. name'],
        type: match['3. type'],
        region: match['4. region'],
        marketOpen: match['5. marketOpen'],
        marketClose: match['6. marketClose'],
        timezone: match['7. timezone'],
        currency: match['8. currency'],
        matchScore: parseFloat(match['9. matchScore'])
      }))
      .sort((a, b) => b.matchScore - a.matchScore);
    
    // Filter to only stocks and ETFs, not futures, currencies, etc.
    const filteredResults = results.filter(
      result => result.type === 'Equity' || result.type === 'ETF'
    );
    
    console.log(`[stock-search.js] Found ${filteredResults.length} results for "${query}"`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        query,
        results: filteredResults.slice(0, 10), // Return top 10 results
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error(`[stock-search.js] Error:`, error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Search error',
        details: error.message,
        results: []
      })
    };
  }
};// netlify/functions/stock-search.js
// Search for stocks by symbol or name

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const query = event.queryStringParameters?.query;
    
    if (!query || query.length < 2) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Query must be at least 2 characters long',
          results: []
        })
      };
    }
    
    console.log(`[stock-search.js] Searching for: ${query}`);
    
    const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
    
    if (!API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Alpha Vantage API key not configured',
          results: []
        })
      };
    }
    
    // Use Alpha Vantage's Symbol Search endpoint
    const searchUrl = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${API_KEY}`;
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      return
