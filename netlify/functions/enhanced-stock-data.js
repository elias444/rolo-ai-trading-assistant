// netlify/functions/enhanced-stock-data.js
// This function fetches more detailed real-time stock data from Alpha Vantage

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
            body: JSON.stringify({ error: 'Symbol parameter is required' })
        };
    }

    try {
        console.log(`[enhanced-stock-data.js] Fetching enhanced data for ${symbol}...`);
        const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

        if (!API_KEY) {
            console.error("[enhanced-stock-data.js] ALPHA_VANTAGE_API_KEY environment variable is not set.");
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Alpha Vantage API key is not configured.' })
            };
        }

        // Example: Fetching TIME_SERIES_INTRADAY for 5min interval with realtime entitlement
        // This can provide more granular data including extended hours
        const urlIntraday = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=5min&entitlement=realtime&outputsize=compact&apikey=${API_KEY}`;
        console.log(`[enhanced-stock-data.js] Calling Alpha Vantage Intraday URL: ${urlIntraday.replace(API_KEY, 'YOUR_API_KEY')}`);

        const responseIntraday = await fetch(urlIntraday);
        if (!responseIntraday.ok) {
            throw new Error(`HTTP error! status: ${responseIntraday.status} from Alpha Vantage Intraday`);
        }
        const dataIntraday = await responseIntraday.json();

        if (dataIntraday['Error Message']) {
            console.error(`[enhanced-stock-data.js] Alpha Vantage Intraday Error: ${dataIntraday['Error Message']}`);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: `Alpha Vantage Intraday API error: ${dataIntraday['Error Message']}. Please ensure your key has options entitlement.` })
            };
        }
        if (dataIntraday['Note']) {
            console.warn(`[enhanced-stock-data.js] Alpha Vantage Intraday Note: ${dataIntraday['Note']}`);
            // Don't error out on a note, but return the note
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    symbol: symbol,
                    message: `Data is limited or delayed: ${dataIntraday['Note']}`,
                    details: dataIntraday,
                    source: 'Alpha Vantage Enhanced (Note)'
                })
            };
        }

        const timeSeriesKey = `Time Series (5min)`;
        const timeSeries = dataIntraday[timeSeriesKey];
        let latestQuote = {};
        if (timeSeries) {
            const latestTimestamp = Object.keys(timeSeries).sort().pop(); // Get most recent timestamp
            latestQuote = timeSeries[latestTimestamp];
        } else {
            console.warn(`[enhanced-stock-data.js] No 5-min time series found for ${symbol}. Falling back to GLOBAL_QUOTE.`);
            // If intraday fails or no data, fall back to GLOBAL_QUOTE
            const urlGlobalQuote = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&entitlement=realtime&apikey=${API_KEY}`;
            const responseGlobalQuote = await fetch(urlGlobalQuote);
            if (!responseGlobalQuote.ok) {
                throw new Error(`HTTP error! status: ${responseGlobalQuote.status} from Alpha Vantage GLOBAL_QUOTE`);
            }
            const dataGlobalQuote = await responseGlobalQuote.json();

            if (dataGlobalQuote['Global Quote'] && dataGlobalQuote['Global Quote']['05. price']) {
                latestQuote = dataGlobalQuote['Global Quote'];
                latestQuote['timestamp'] = dataGlobalQuote['Global Quote']['07. latest trading day']; // Map to common key
            } else {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({
                        error: `No enhanced or global quote data found for ${symbol}.`,
                        details: dataGlobalQuote
                    })
                };
            }
        }

        const enhancedStockData = {
            symbol: symbol.toUpperCase(),
            price: parseFloat(latestQuote['05. price'] || latestQuote['4. close']).toFixed(2), // Use 05. price or 4. close from intraday
            open: parseFloat(latestQuote['02. open'] || latestQuote['1. open']).toFixed(2),
            high: parseFloat(latestQuote['03. high'] || latestQuote['2. high']).toFixed(2),
            low: parseFloat(latestQuote['04. low'] || latestQuote['3. low']).toFixed(2),
            volume: parseInt(latestQuote['06. volume'] || latestQuote['5. volume']).toLocaleString(),
            change: parseFloat(latestQuote['09. change'] || '0').toFixed(2), // Global Quote has change
            changePercent: latestQuote['10. change percent'] || '0.00%', // Global Quote has change percent
            lastUpdated: latestQuote['07. latest trading day'] || latestQuote['timestamp'], // Global Quote has latest trading day
            isRealTime: true, // Assuming realtime entitlement is enabled
            fullRawData: dataIntraday // Include full raw data for debugging/more detailed display
        };

        console.log(`[enhanced-stock-data.js] Success: ${symbol} = $${enhancedStockData.price}`);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(enhancedStockData)
        };

    } catch (error) {
        console.error(`[enhanced-stock-data.js] Error for ${symbol}:`, error);
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
