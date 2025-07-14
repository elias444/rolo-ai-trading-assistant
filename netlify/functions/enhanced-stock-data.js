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

        // Determine market session based on current time
        const now = new Date();
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        const est = new Date(utcTime + (-5 * 3600000)); // EST timezone
        const hours = est.getHours();
        const minutes = est.getMinutes();
        const day = est.getDay();
        
        let marketSession = 'Market Closed';
        if (day === 0 || day === 6) {
            marketSession = day === 0 && hours >= 18 ? 'Futures Open' : 'Weekend';
        } else {
            const totalMinutes = hours * 60 + minutes;
            if (totalMinutes >= 240 && totalMinutes < 570) {
                marketSession = 'Pre-Market';
            } else if (totalMinutes >= 570 && totalMinutes < 960) {
                marketSession = 'Market Open';
            } else if (totalMinutes >= 960 && totalMinutes < 1200) {
                marketSession = 'After Hours';
            } else {
                marketSession = 'Futures Open';
            }
        }

        // Try intraday data first for more granular information
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
                body: JSON.stringify({ error: `Alpha Vantage Intraday API error: ${dataIntraday['Error Message']}. Please ensure your key has realtime entitlement.` })
            };
        }

        if (dataIntraday['Note']) {
            console.warn(`[enhanced-stock-data.js] Alpha Vantage Intraday Note: ${dataIntraday['Note']}`);
            // Rate limit hit, fall back to GLOBAL_QUOTE
        }

        const timeSeriesKey = `Time Series (5min)`;
        const timeSeries = dataIntraday[timeSeriesKey];
        let latestQuote = {};
        let dataSource = 'Intraday';

        if (timeSeries && Object.keys(timeSeries).length > 0) {
            const latestTimestamp = Object.keys(timeSeries).sort().pop(); // Get most recent timestamp
            latestQuote = timeSeries[latestTimestamp];
            latestQuote['timestamp'] = latestTimestamp;
        } else {
            console.warn(`[enhanced-stock-data.js] No 5-min time series found for ${symbol}. Falling back to GLOBAL_QUOTE.`);
            // If intraday fails or no data, fall back to GLOBAL_QUOTE
            const urlGlobalQuote = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&entitlement=realtime&apikey=${API_KEY}`;
            const responseGlobalQuote = await fetch(urlGlobalQuote);
            if (!responseGlobalQuote.ok) {
                throw new Error(`HTTP error! status: ${responseGlobalQuote.status} from Alpha Vantage GLOBAL_QUOTE`);
            }
            const dataGlobalQuote = await responseGlobalQuote.json();

            if (dataGlobalQuote['Error Message']) {
                console.error(`[enhanced-stock-data.js] Alpha Vantage Global Quote Error: ${dataGlobalQuote['Error Message']}`);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ error: `Alpha Vantage API error: ${dataGlobalQuote['Error Message']}` })
                };
            }

            if (dataGlobalQuote['Global Quote'] && dataGlobalQuote['Global Quote']['05. price']) {
                latestQuote = dataGlobalQuote['Global Quote'];
                latestQuote['timestamp'] = dataGlobalQuote['Global Quote']['07. latest trading day'];
                dataSource = 'Global Quote';
            } else {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({
                        error: `No data found for symbol ${symbol}. Please check if the symbol is correct.`,
                        details: dataGlobalQuote
                    })
                };
            }
        }

        // Map the data to a consistent format
        const enhancedStockData = {
            symbol: symbol.toUpperCase(),
            price: parseFloat(latestQuote['05. price'] || latestQuote['4. close']).toFixed(2),
            open: parseFloat(latestQuote['02. open'] || latestQuote['1. open']).toFixed(2),
            high: parseFloat(latestQuote['03. high'] || latestQuote['2. high']).toFixed(2),
            low: parseFloat(latestQuote['04. low'] || latestQuote['3. low']).toFixed(2),
            volume: parseInt(latestQuote['06. volume'] || latestQuote['5. volume'] || 0).toLocaleString(),
            change: parseFloat(latestQuote['09. change'] || 0).toFixed(2),
            changePercent: latestQuote['10. change percent'] || '0.00%',
            lastUpdated: latestQuote['07. latest trading day'] || latestQuote['timestamp'],
            marketSession: marketSession,
            dataSource: dataSource,
            isRealTime: dataSource === 'Intraday',
            timestamp: new Date().toISOString()
        };

        // Calculate change percent if not provided
        if (!latestQuote['10. change percent'] && enhancedStockData.price && enhancedStockData.open) {
            const changePercent = ((parseFloat(enhancedStockData.price) - parseFloat(enhancedStockData.open)) / parseFloat(enhancedStockData.open) * 100).toFixed(2);
            enhancedStockData.changePercent = `${changePercent}%`;
        }

        console.log(`[enhanced-stock-data.js] Success: ${symbol} = $${enhancedStockData.price} (${marketSession}, ${dataSource})`);
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
                error: `Server error while fetching data for ${symbol}: ${error.message}`,
                details: 'Please check if the symbol is correct and try again'
            })
        };
    }
};
