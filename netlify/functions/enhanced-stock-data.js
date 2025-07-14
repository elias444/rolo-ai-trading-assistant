// netlify/functions/enhanced-stock-data.js
// Enhanced stock data with real-time, pre-market, futures support

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

        // Enhanced market session detection
        const now = new Date();
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        const est = new Date(utcTime + (-5 * 3600000)); // EST timezone
        const hours = est.getHours();
        const minutes = est.getMinutes();
        const day = est.getDay(); // 0 = Sunday, 6 = Saturday
        const totalMinutes = hours * 60 + minutes;
        
        let marketSession = 'Market Closed';
        let dataSource = 'daily';
        let dataInterval = '5min';
        
        if (day === 0) { // Sunday
            if (hours >= 18) {
                marketSession = 'Futures Open';
                dataSource = 'intraday';
                dataInterval = '5min';
            } else {
                marketSession = 'Weekend';
                dataSource = 'daily';
            }
        } else if (day === 6) { // Saturday
            marketSession = 'Weekend';
            dataSource = 'daily';
        } else { // Monday-Friday
            if (totalMinutes >= 240 && totalMinutes < 570) { // 4:00 AM - 9:30 AM
                marketSession = 'Pre-Market';
                dataSource = 'intraday';
                dataInterval = '5min';
            } else if (totalMinutes >= 570 && totalMinutes < 960) { // 9:30 AM - 4:00 PM
                marketSession = 'Market Open';
                dataSource = 'realtime';
                dataInterval = '1min';
            } else if (totalMinutes >= 960 && totalMinutes < 1200) { // 4:00 PM - 8:00 PM
                marketSession = 'After Hours';
                dataSource = 'intraday';
                dataInterval = '5min';
            } else if (totalMinutes >= 1080 || totalMinutes < 240) { // 6:00 PM - 4:00 AM
                marketSession = 'Futures Open';
                dataSource = 'intraday';
                dataInterval = '5min';
            } else {
                marketSession = 'Market Closed';
                dataSource = 'daily';
            }
        }

        console.log(`[enhanced-stock-data.js] Market session: ${marketSession}, Data source: ${dataSource}`);

        let stockData = null;
        let fetchedDataType = 'unknown';

        // Strategy 1: Try real-time intraday data first (for active sessions)
        if (dataSource === 'realtime' || dataSource === 'intraday') {
            try {
                const intradayUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=${dataInterval}&entitlement=realtime&outputsize=compact&apikey=${API_KEY}`;
                console.log(`[enhanced-stock-data.js] Trying intraday (${dataInterval}) for ${symbol}`);

                const intradayResponse = await fetch(intradayUrl);
                const intradayData = await intradayResponse.json();

                if (intradayData[`Time Series (${dataInterval})`]) {
                    const timeSeries = intradayData[`Time Series (${dataInterval})`];
                    const timestamps = Object.keys(timeSeries).sort().reverse(); // Most recent first
                    
                    if (timestamps.length > 0) {
                        const latestTimestamp = timestamps[0];
                        const latestData = timeSeries[latestTimestamp];
                        
                        // Calculate change from previous period
                        let change = 0;
                        let changePercent = '0.00%';
                        
                        if (timestamps.length > 1) {
                            const previousData = timeSeries[timestamps[1]];
                            const currentPrice = parseFloat(latestData['4. close']);
                            const previousPrice = parseFloat(previousData['4. close']);
                            change = currentPrice - previousPrice;
                            changePercent = `${((change / previousPrice) * 100).toFixed(2)}%`;
                        } else {
                            // Fallback: compare with opening price
                            const currentPrice = parseFloat(latestData['4. close']);
                            const openPrice = parseFloat(latestData['1. open']);
                            change = currentPrice - openPrice;
                            changePercent = `${((change / openPrice) * 100).toFixed(2)}%`;
                        }

                        stockData = {
                            symbol: symbol.toUpperCase(),
                            price: parseFloat(latestData['4. close']).toFixed(2),
                            open: parseFloat(latestData['1. open']).toFixed(2),
                            high: parseFloat(latestData['2. high']).toFixed(2),
                            low: parseFloat(latestData['3. low']).toFixed(2),
                            volume: parseInt(latestData['5. volume'] || 0).toLocaleString(),
                            change: change.toFixed(2),
                            changePercent: changePercent,
                            lastUpdated: latestTimestamp,
                            marketSession: marketSession,
                            dataSource: `Intraday ${dataInterval}`,
                            isRealTime: dataSource === 'realtime',
                            timestamp: new Date().toISOString()
                        };
                        
                        fetchedDataType = `intraday_${dataInterval}`;
                        console.log(`[enhanced-stock-data.js] Successfully fetched intraday data for ${symbol}`);
                    }
                } else if (intradayData['Note']) {
                    console.warn(`[enhanced-stock-data.js] Alpha Vantage rate limit: ${intradayData['Note']}`);
                } else if (intradayData['Error Message']) {
                    console.warn(`[enhanced-stock-data.js] Intraday API error: ${intradayData['Error Message']}`);
                }
            } catch (error) {
                console.warn(`[enhanced-stock-data.js] Intraday fetch failed: ${error.message}`);
            }
        }

        // Strategy 2: Fallback to Global Quote if intraday failed or not needed
        if (!stockData) {
            try {
                const globalQuoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&entitlement=realtime&apikey=${API_KEY}`;
                console.log(`[enhanced-stock-data.js] Falling back to Global Quote for ${symbol}`);

                const globalResponse = await fetch(globalQuoteUrl);
                const globalData = await globalResponse.json();

                if (globalData['Global Quote'] && globalData['Global Quote']['05. price']) {
                    const quote = globalData['Global Quote'];
                    
                    stockData = {
                        symbol: symbol.toUpperCase(),
                        price: parseFloat(quote['05. price']).toFixed(2),
                        open: parseFloat(quote['02. open']).toFixed(2),
                        high: parseFloat(quote['03. high']).toFixed(2),
                        low: parseFloat(quote['04. low']).toFixed(2),
                        volume: parseInt(quote['06. volume'] || 0).toLocaleString(),
                        change: parseFloat(quote['09. change'] || 0).toFixed(2),
                        changePercent: quote['10. change percent'] || '0.00%',
                        lastUpdated: quote['07. latest trading day'],
                        marketSession: marketSession,
                        dataSource: 'Global Quote',
                        isRealTime: false,
                        timestamp: new Date().toISOString()
                    };
                    
                    fetchedDataType = 'global_quote';
                    console.log(`[enhanced-stock-data.js] Successfully fetched Global Quote for ${symbol}`);
                } else if (globalData['Error Message']) {
                    console.error(`[enhanced-stock-data.js] Global Quote error: ${globalData['Error Message']}`);
                    return {
                        statusCode: 500,
                        headers,
                        body: JSON.stringify({ 
                            error: `Alpha Vantage API error: ${globalData['Error Message']}`,
                            details: 'Please check if the symbol is correct'
                        })
                    };
                } else {
                    console.error(`[enhanced-stock-data.js] No valid data in Global Quote response`);
                }
            } catch (error) {
                console.error(`[enhanced-stock-data.js] Global Quote fetch failed: ${error.message}`);
            }
        }

        // Strategy 3: If symbol might be a futures contract, try direct futures data
        if (!stockData && (symbol.includes('=F') || marketSession === 'Futures Open')) {
            try {
                console.log(`[enhanced-stock-data.js] Attempting futures data for ${symbol}`);
                
                // For futures, we might need to use a different approach or proxy ETFs
                const futuresProxyMap = {
                    'ES=F': 'SPY',   // S&P 500 futures -> SPY ETF
                    'NQ=F': 'QQQ',   // NASDAQ futures -> QQQ ETF
                    'YM=F': 'DIA',   // Dow futures -> DIA ETF
                    'RTY=F': 'IWM'   // Russell 2000 futures -> IWM ETF
                };
                
                const proxySymbol = futuresProxyMap[symbol] || symbol;
                
                if (proxySymbol !== symbol) {
                    console.log(`[enhanced-stock-data.js] Using proxy ${proxySymbol} for futures ${symbol}`);
                    
                    const proxyUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${proxySymbol}&entitlement=realtime&apikey=${API_KEY}`;
                    const proxyResponse = await fetch(proxyUrl);
                    const proxyData = await proxyResponse.json();
                    
                    if (proxyData['Global Quote'] && proxyData['Global Quote']['05. price']) {
                        const quote = proxyData['Global Quote'];
                        
                        stockData = {
                            symbol: symbol.toUpperCase(),
                            price: parseFloat(quote['05. price']).toFixed(2),
                            open: parseFloat(quote['02. open']).toFixed(2),
                            high: parseFloat(quote['03. high']).toFixed(2),
                            low: parseFloat(quote['04. low']).toFixed(2),
                            volume: parseInt(quote['06. volume'] || 0).toLocaleString(),
                            change: parseFloat(quote['09. change'] || 0).toFixed(2),
                            changePercent: quote['10. change percent'] || '0.00%',
                            lastUpdated: quote['07. latest trading day'],
                            marketSession: marketSession,
                            dataSource: `Futures Proxy (${proxySymbol})`,
                            isRealTime: false,
                            timestamp: new Date().toISOString()
                        };
                        
                        fetchedDataType = 'futures_proxy';
                        console.log(`[enhanced-stock-data.js] Successfully fetched futures proxy data for ${symbol}`);
                    }
                }
            } catch (error) {
                console.warn(`[enhanced-stock-data.js] Futures data fetch failed: ${error.message}`);
            }
        }

        // Final check: if we still don't have data, return an error
        if (!stockData) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    error: `No data available for symbol ${symbol}`,
                    details: `Tried multiple data sources for ${marketSession} session`,
                    marketSession: marketSession,
                    suggestion: 'Please verify the symbol is correct and markets are active'
                })
            };
        }

        // Add additional metadata
        const enhancedData = {
            ...stockData,
            fetchStrategy: fetchedDataType,
            estTime: est.toLocaleString('en-US', { timeZone: 'America/New_York' }),
            nextUpdate: new Date(Date.now() + getUpdateInterval(marketSession)).toLocaleTimeString(),
            updateFrequency: getUpdateFrequencyText(marketSession)
        };

        console.log(`[enhanced-stock-data.js] SUCCESS: ${symbol} = ${enhancedData.price} (${marketSession}, ${fetchedDataType})`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(enhancedData)
        };

    } catch (error) {
        console.error(`[enhanced-stock-data.js] Unexpected error for ${symbol}:`, error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: `Server error while fetching data for ${symbol}: ${error.message}`,
                details: 'Please check server logs and try again',
                timestamp: new Date().toISOString()
            })
        };
    }
};

// Helper function to determine update intervals
function getUpdateInterval(marketSession) {
    switch (marketSession) {
        case 'Market Open':
            return 30000; // 30 seconds
        case 'Pre-Market':
        case 'After Hours':
            return 60000; // 1 minute
        case 'Futures Open':
            return 120000; // 2 minutes
        default:
            return 300000; // 5 minutes
    }
}

// Helper function for update frequency text
function getUpdateFrequencyText(marketSession) {
    switch (marketSession) {
        case 'Market Open':
            return 'Updates every 30 seconds';
        case 'Pre-Market':
        case 'After Hours':
            return 'Updates every 1 minute';
        case 'Futures Open':
            return 'Updates every 2 minutes';
        default:
            return 'Updates every 5 minutes';
    }
}
