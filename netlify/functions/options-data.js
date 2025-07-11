// netlify/functions/options-data.js
// This function fetches options data from Alpha Vantage

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

    const symbol = event.queryStringParameters?.symbol;
    if (!symbol) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Symbol parameter is required (e.g., /.netlify/functions/options-data?symbol=AAPL)' })
        };
    }

    try {
        console.log(`[options-data.js] Fetching options data for ${symbol}...`);
        const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

        if (!API_KEY) {
            console.error("[options-data.js] ALPHA_VANTAGE_API_KEY environment variable is not set.");
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Alpha Vantage API key is not configured.' })
            };
        }

        const expiration = event.queryStringParameters?.expiration; // Optional expiration parameter

        if (expiration) {
            // Fetch specific options chain for an expiration date
            const url = `https://www.alphavantage.co/query?function=REALTIME_OPTIONS&symbol=${symbol}&expiration=${expiration}&apikey=${API_KEY}`;
            console.log(`[options-data.js] Calling Alpha Vantage Options Chain URL: ${url.replace(API_KEY, 'YOUR_API_KEY')}`);

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} from Alpha Vantage Options Chain`);
            }
            const data = await response.json();

            if (data['Error Message']) {
                console.error(`[options-data.js] Alpha Vantage Options Error: ${data['Error Message']}`);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ error: `Alpha Vantage Options API error: ${data['Error Message']}. Please ensure your key has options entitlement.` })
                };
            }
            if (data['Note']) {
                console.warn(`[options-data.js] Alpha Vantage Options Note: ${data['Note']}`);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        symbol: symbol,
                        message: `Options data is limited or delayed: ${data['Note']}`,
                        details: data,
                        source: 'Alpha Vantage Options (Note)'
                    })
                };
            }

            console.log(`[options-data.js] Successfully fetched options chain for ${symbol} and expiration ${expiration}.`);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(data) // Return the full options chain data
            };

        } else {
            // If no specific expiration is provided, return an error asking for it
            console.warn(`[options-data.js] No expiration date provided for ${symbol}. Please provide a specific expiration (YYYY-MM-DD).`);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: `Please provide an 'expiration' date (YYYY-MM-DD) as a query parameter (e.g., &expiration=2025-07-19) for options data.`,
                    details: 'Alpha Vantage REALTIME_OPTIONS function typically requires a specific expiration date.'
                })
            };
        }

    } catch (error) {
        console.error(`[options-data.js] Error for ${symbol}:`, error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: `An unexpected server error occurred: ${error.message}. Please check Netlify function logs.`,
                details: error.message
            })
        };
    }
};
