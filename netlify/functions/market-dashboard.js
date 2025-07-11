// netlify/functions/market-dashboard.js
// This function fetches global market data from Alpha Vantage

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
        console.log(`[market-dashboard.js] Fetching market dashboard data...`);
        const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

        if (!API_KEY) {
            console.error("[market-dashboard.js] ALPHA_VANTAGE_API_KEY environment variable is not set.");
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Alpha Vantage API key is not configured.' })
            };
        }

        const marketData = {};

        // --- Fetch S&P 500 (GSPC) ---
        const spxUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=SPY&entitlement=realtime&apikey=${API_KEY}`; // SPY ETF often used as proxy for S&P 500
        console.log(`[market-dashboard.js] Calling Alpha Vantage for SPY: ${spxUrl.replace(API_KEY, 'YOUR_API_KEY')}`);
        const spxResponse = await fetch(spxUrl);
        const spxData = await spxResponse.json();
        if (spxResponse.ok && spxData['Global Quote'] && spxData['Global Quote']['05. price']) {
            const quote = spxData['Global Quote'];
            marketData.sp500 = {
                symbol: 'S&P 500 (SPY)',
                price: parseFloat(quote['05. price']).toFixed(2),
                change: parseFloat(quote['09. change']).toFixed(2),
                changePercent: quote['10. change percent']
            };
        } else {
            console.warn(`[market-dashboard.js] Could not fetch S&P 500 (SPY) data:`, spxData);
            marketData.sp500 = { error: 'Could not fetch S&P 500 data' };
        }

        // --- Fetch Dow Jones Industrial Average (DIA) ---
        const djiaUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=DIA&entitlement=realtime&apikey=${API_KEY}`; // DIA ETF for Dow Jones
        console.log(`[market-dashboard.js] Calling Alpha Vantage for DIA: ${djiaUrl.replace(API_KEY, 'YOUR_API_KEY')}`);
        const djiaResponse = await fetch(djiaUrl);
        const djiaData = await djiaResponse.json();
        if (djiaResponse.ok && djiaData['Global Quote'] && djiaData['Global Quote']['05. price']) {
            const quote = djiaData['Global Quote'];
            marketData.dowJones = {
                symbol: 'Dow Jones (DIA)',
                price: parseFloat(quote['05. price']).toFixed(2),
                change: parseFloat(quote['09. change']).toFixed(2),
                changePercent: quote['10. change percent']
            };
        } else {
            console.warn(`[market-dashboard.js] Could not fetch Dow Jones (DIA) data:`, djiaData);
            marketData.dowJones = { error: 'Could not fetch Dow Jones data' };
        }

        // --- Fetch NASDAQ (QQQ) ---
        const nasdaqUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=QQQ&entitlement=realtime&apikey=${API_KEY}`; // QQQ ETF for NASDAQ 100
        console.log(`[market-dashboard.js] Calling Alpha Vantage for QQQ: ${nasdaqUrl.replace(API_KEY, 'YOUR_API_KEY')}`);
        const nasdaqResponse = await fetch(nasdaqUrl);
        const nasdaqData = await nasdaqResponse.json();
        if (nasdaqResponse.ok && nasdaqData['Global Quote'] && nasdaqData['Global Quote']['05. price']) {
            const quote = nasdaqData['Global Quote'];
            marketData.nasdaq = {
                symbol: 'NASDAQ (QQQ)',
                price: parseFloat(quote['05. price']).toFixed(2),
                change: parseFloat(quote['09. change']).toFixed(2),
                changePercent: quote['10. change percent']
            };
        } else {
            console.warn(`[market-dashboard.js] Could not fetch NASDAQ (QQQ) data:`, nasdaqData);
            marketData.nasdaq = { error: 'Could not fetch NASDAQ data' };
        }

        // --- Fetch Gold Futures (GC=F from Yahoo Finance if Alpha Vantage doesn't support directly) ---
        // Alpha Vantage has commodities data, e.g., for WTI Crude Oil (function=WTI), but not standard futures symbols like GC=F directly.
        // For general futures like Gold or Crude Oil, you would use their specific commodity APIs.
        // Example for Crude Oil (WTI):
        const wtiOilUrl = `https://www.alphavantage.co/query?function=WTI&interval=monthly&apikey=${API_KEY}`; // Using monthly as daily for commodities often needs premium
        console.log(`[market-dashboard.js] Calling Alpha Vantage for WTI Oil: ${wtiOilUrl.replace(API_KEY, 'YOUR_API_KEY')}`);
        const wtiOilResponse = await fetch(wtiOilUrl);
        const wtiOilData = await wtiOilResponse.json();
        if (wtiOilResponse.ok && wtiOilData.data && wtiOilData.data.length > 0) {
            const latest = wtiOilData.data[0];
            marketData.wtiOil = {
                symbol: 'WTI Crude Oil',
                price: parseFloat(latest.value).toFixed(2),
                date: latest.date
            };
        } else {
            console.warn(`[market-dashboard.js] Could not fetch WTI Oil data:`, wtiOilData);
            marketData.wtiOil = { error: 'Could not fetch WTI Oil data' };
        }

        // IMPORTANT: Alpha Vantage generally doesn't provide direct VIX index data through GLOBAL_QUOTE
        // It provides VIX-related APIs under "Alpha Intelligence™" like 'Top Gainers & Losers' etc.
        // If you need direct VIX, you might need a different API or a more complex solution
        // that analyzes S&P 500 options data or uses a different data provider.
        marketData.vix = { message: 'VIX data not directly available via standard Alpha Vantage GLOBAL_QUOTE. Consider other APIs or derived data.' };


        console.log(`[market-dashboard.js] Successfully fetched market dashboard data.`);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(marketData)
        };

    } catch (error) {
        console.error(`[market-dashboard.js] Unexpected server error:`, error);
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
