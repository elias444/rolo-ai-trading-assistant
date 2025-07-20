// netlify/functions/enhanced-stock-data.js
// Enhanced stock data with session detection - ZERO MOCK DATA

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
        const symbol = event.queryStringParameters?.symbol;
        
        if (!symbol) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: 'Symbol parameter is required',
                    timestamp: new Date().toISOString()
                })
            };
        }

        const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
        
        if (!API_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Alpha Vantage API key not configured',
                    timestamp: new Date().toISOString()
                })
            };
        }

        console.log(`[enhanced-stock-data.js] Fetching real data for ${symbol}`);
        
        // Determine current market session
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const dayOfWeek = now.getDay();
        
        let marketSession = 'CLOSED';
        let dataType = 'regular';
        
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            marketSession = 'WEEKEND';
            dataType = 'latest_available';
        } else if (currentTime >= 930 && currentTime < 1600) {
            marketSession = 'MARKET_OPEN';
            dataType = 'realtime';
        } else if (currentTime >= 400 && currentTime < 930) {
            marketSession = 'PRE_MARKET';
            dataType = 'extended_hours';
        } else if (currentTime >= 1600 && currentTime < 2000) {
            marketSession = 'AFTER_HOURS';
            dataType = 'extended_hours';
        } else {
            marketSession = 'FUTURES_OPEN';
            dataType = 'latest_available';
        }

        let stockData = null;

        // Strategy 1: Real-time during market hours
        if (dataType === 'realtime') {
            const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;
            const quoteResponse = await fetch(quoteUrl);
            const quoteJson = await quoteResponse.json();
            
            if (quoteJson['Global Quote']) {
                const quote = quoteJson['Global Quote'];
                stockData = {
                    symbol: quote['01. symbol'],
                    price: parseFloat(quote['05. price']),
                    change: parseFloat(quote['09. change']),
                    changePercent: quote['10. change percent'],
                    volume: parseInt(quote['06. volume']),
                    high: parseFloat(quote['03. high']),
                    low: parseFloat(quote['04. low']),
                    previousClose: parseFloat(quote['08. previous close']),
                    marketSession: marketSession,
                    dataType: 'Real-time',
                    lastUpdated: quote['07. latest trading day']
                };
            }
        }
        
        // Strategy 2: Extended hours data
        else if (dataType === 'extended_hours') {
            try {
                const extendedUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=5min&extended_hours=true&apikey=${API_KEY}`;
                const extendedResponse = await fetch(extendedUrl);
                const extendedJson = await extendedResponse.json();
                
                if (extendedJson['Time Series (5min)']) {
                    const timeSeries = extendedJson['Time Series (5min)'];
                    const latestTime = Object.keys(timeSeries)[0];
                    const latestData = timeSeries[latestTime];
                    
                    // Get previous day's close for comparison
                    const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;
                    const quoteResponse = await fetch(quoteUrl);
                    const quoteJson = await quoteResponse.json();
                    
                    let previousClose = 0;
                    if (quoteJson['Global Quote']) {
                        previousClose = parseFloat(quoteJson['Global Quote']['08. previous close']);
                    }
                    
                    const currentPrice = parseFloat(latestData['4. close']);
                    const change = currentPrice - previousClose;
                    const changePercent = ((change / previousClose) * 100).toFixed(2) + '%';
                    
                    stockData = {
                        symbol: symbol,
                        price: currentPrice,
                        change: change,
                        changePercent: changePercent,
                        volume: parseInt(latestData['5. volume']),
                        high: parseFloat(latestData['2. high']),
                        low: parseFloat(latestData['3. low']),
                        previousClose: previousClose,
                        marketSession: marketSession,
                        dataType: 'Extended Hours',
                        lastUpdated: latestTime,
                        extendedHours: true
                    };
                }
            } catch (extendedError) {
                console.warn(`[enhanced-stock-data.js] Extended hours failed, falling back to regular quote: ${extendedError.message}`);
                
                // Fallback to regular quote
                const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;
                const quoteResponse = await fetch(quoteUrl);
                const quoteJson = await quoteResponse.json();
                
                if (quoteJson['Global Quote']) {
                    const quote = quoteJson['Global Quote'];
                    stockData = {
                        symbol: quote['01. symbol'],
                        price: parseFloat(quote['05. price']),
                        change: parseFloat(quote['09. change']),
                        changePercent: quote['10. change percent'],
                        volume: parseInt(quote['06. volume']),
                        high: parseFloat(quote['03. high']),
                        low: parseFloat(quote['04. low']),
                        previousClose: parseFloat(quote['08. previous close']),
                        marketSession: marketSession,
                        dataType: 'Latest Available',
                        lastUpdated: quote['07. latest trading day']
                    };
                }
            }
        }
        
        // Strategy 3: Latest available data (weekends/futures)
        else {
            const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;
            const quoteResponse = await fetch(quoteUrl);
            const quoteJson = await quoteResponse.json();
            
            if (quoteJson['Global Quote']) {
                const quote = quoteJson['Global Quote'];
                stockData = {
                    symbol: quote['01. symbol'],
                    price: parseFloat(quote['05. price']),
                    change: parseFloat(quote['09. change']),
                    changePercent: quote['10. change percent'],
                    volume: parseInt(quote['06. volume']),
                    high: parseFloat(quote['03. high']),
                    low: parseFloat(quote['04. low']),
                    previousClose: parseFloat(quote['08. previous close']),
                    marketSession: marketSession,
                    dataType: 'Latest Available',
                    lastUpdated: quote['07. latest trading day']
                };
            }
        }

        // Only return data if we successfully got real data
        if (!stockData) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    error: `No real data available for ${symbol}`,
                    symbol: symbol,
                    marketSession: marketSession,
                    timestamp: new Date().toISOString(),
                    dataSource: "Alpha Vantage - No Data"
                })
            };
        }

        console.log(`[enhanced-stock-data.js] Successfully fetched real data for ${symbol}: $${stockData.price}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                ...stockData,
                timestamp: new Date().toISOString(),
                dataSource: "Alpha Vantage Real-Time",
                apiCallTime: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('[enhanced-stock-data.js] Error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Stock data fetch error",
                details: error.message,
                timestamp: new Date().toISOString(),
                dataSource: "Error - No Data Available"
            })
        };
    }
};
