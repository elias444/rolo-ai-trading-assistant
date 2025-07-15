// netlify/functions/market-dashboard.js
// FIXED market dashboard with correct Alpha Vantage symbols and live futures

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
        console.log(`[market-dashboard.js] Starting FIXED market data fetch...`);
        const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

        if (!API_KEY) {
            console.error("[market-dashboard.js] ALPHA_VANTAGE_API_KEY environment variable is not set.");
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Alpha Vantage API key is not configured.' })
            };
        }

        // Determine current market session
        const now = new Date();
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        const est = new Date(utcTime + (-5 * 3600000));
        const hours = est.getHours();
        const minutes = est.getMinutes();
        const day = est.getDay();
        const totalMinutes = hours * 60 + minutes;
        
        let marketSession = 'Market Closed';
        let dataStrategy = 'daily';
        
        if (day === 0) { // Sunday
            if (hours >= 18) {
                marketSession = 'Futures Open';
                dataStrategy = 'futures';
            } else {
                marketSession = 'Weekend';
                dataStrategy = 'daily';
            }
        } else if (day === 6) { // Saturday
            marketSession = 'Weekend';
            dataStrategy = 'daily';
        } else { // Monday-Friday
            if (totalMinutes >= 240 && totalMinutes < 570) { // 4:00 AM - 9:30 AM
                marketSession = 'Pre-Market';
                dataStrategy = 'futures'; // Use futures for pre-market
            } else if (totalMinutes >= 570 && totalMinutes < 960) { // 9:30 AM - 4:00 PM
                marketSession = 'Market Open';
                dataStrategy = 'realtime';
            } else if (totalMinutes >= 960 && totalMinutes < 1200) { // 4:00 PM - 8:00 PM
                marketSession = 'After Hours';
                dataStrategy = 'futures'; // Use futures for after hours
            } else if (totalMinutes >= 1080 || totalMinutes < 240) { // 6:00 PM - 4:00 AM
                marketSession = 'Futures Open';
                dataStrategy = 'futures';
            } else {
                marketSession = 'Market Closed';
                dataStrategy = 'daily';
            }
        }

        console.log(`[market-dashboard.js] Session: ${marketSession}, Strategy: ${dataStrategy}, EST: ${est.toLocaleString()}`);

        const marketData = {
            timestamp: new Date().toISOString(),
            estTime: est.toLocaleString(),
            marketSession: marketSession,
            dataStrategy: dataStrategy
        };

        // === CORRECT ALPHA VANTAGE SYMBOLS ===
        const indexConfig = {
            'sp500': {
                live: 'SPX',           // Confirmed working S&P 500 symbol
                futures: 'ES=F',       // E-mini S&P 500 Futures
                name: 'S&P 500 Index'
            },
            'nasdaq': {
                live: 'IXIC',          // Confirmed working NASDAQ symbol
                futures: 'NQ=F',       // E-mini NASDAQ Futures
                name: 'NASDAQ Composite'
            },
            'dowJones': {
                live: 'DJI',           // Confirmed working Dow Jones symbol
                futures: 'YM=F',       // E-mini Dow Futures
                name: 'Dow Jones Industrial Average'
            },
            'russell2000': {
                live: 'RUT',           // Russell 2000 symbol
                futures: 'RTY=F',      // E-mini Russell 2000 Futures
                name: 'Russell 2000 Index'
            }
        };

        // Helper function to fetch real-time data with multiple attempts
        async function fetchRealTimeData(symbol, dataType = 'index') {
            console.log(`[market-dashboard.js] Fetching ${dataType} data for ${symbol}...`);
            
            try {
                // Method 1: Try intraday data first (most current)
                console.log(`[market-dashboard.js] Trying intraday 1min for ${symbol}...`);
                const intradayUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=1min&entitlement=realtime&outputsize=compact&apikey=${API_KEY}`;
                const intradayResponse = await fetch(intradayUrl);
                const intradayData = await intradayResponse.json();
                
                if (intradayData['Time Series (1min)']) {
                    const timeSeries = intradayData['Time Series (1min)'];
                    const timestamps = Object.keys(timeSeries).sort().reverse();
                    
                    if (timestamps.length > 0) {
                        const latest = timeSeries[timestamps[0]];
                        const previous = timestamps.length > 1 ? timeSeries[timestamps[1]] : null;
                        
                        const currentPrice = parseFloat(latest['4. close']);
                        const openPrice = parseFloat(latest['1. open']);
                        const previousPrice = previous ? parseFloat(previous['4. close']) : openPrice;
                        const change = currentPrice - previousPrice;
                        const changePercent = ((change / previousPrice) * 100).toFixed(2);
                        
                        console.log(`[market-dashboard.js] ✅ SUCCESS intraday ${symbol}: $${currentPrice.toFixed(2)}`);
                        return {
                            price: currentPrice.toFixed(2),
                            change: change.toFixed(2),
                            changePercent: `${changePercent}%`,
                            volume: parseInt(latest['5. volume'] || 0).toLocaleString(),
                            timestamp: timestamps[0],
                            dataType: 'realtime_intraday',
                            success: true
                        };
                    }
                }
                
                // Method 2: Try 5min intraday for futures
                if (dataType === 'futures') {
                    console.log(`[market-dashboard.js] Trying intraday 5min for futures ${symbol}...`);
                    const intradayUrl5 = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=5min&entitlement=realtime&outputsize=compact&apikey=${API_KEY}`;
                    const intradayResponse5 = await fetch(intradayUrl5);
                    const intradayData5 = await intradayResponse5.json();
                    
                    if (intradayData5['Time Series (5min)']) {
                        const timeSeries = intradayData5['Time Series (5min)'];
                        const timestamps = Object.keys(timeSeries).sort().reverse();
                        
                        if (timestamps.length > 0) {
                            const latest = timeSeries[timestamps[0]];
                            const previous = timestamps.length > 1 ? timeSeries[timestamps[1]] : null;
                            
                            const currentPrice = parseFloat(latest['4. close']);
                            const openPrice = parseFloat(latest['1. open']);
                            const previousPrice = previous ? parseFloat(previous['4. close']) : openPrice;
                            const change = currentPrice - previousPrice;
                            const changePercent = ((change / previousPrice) * 100).toFixed(2);
                            
                            console.log(`[market-dashboard.js] ✅ SUCCESS 5min futures ${symbol}: $${currentPrice.toFixed(2)}`);
                            return {
                                price: currentPrice.toFixed(2),
                                change: change.toFixed(2),
                                changePercent: `${changePercent}%`,
                                volume: parseInt(latest['5. volume'] || 0).toLocaleString(),
                                timestamp: timestamps[0],
                                dataType: 'futures_intraday',
                                success: true
                            };
                        }
                    }
                }
                
                // Method 3: Try global quote
                console.log(`[market-dashboard.js] Trying global quote for ${symbol}...`);
                const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&entitlement=realtime&apikey=${API_KEY}`;
                const quoteResponse = await fetch(quoteUrl);
                const quoteData = await quoteResponse.json();
                
                if (quoteData['Global Quote'] && quoteData['Global Quote']['05. price']) {
                    const quote = quoteData['Global Quote'];
                    const price = parseFloat(quote['05. price']);
                    const change = parseFloat(quote['09. change'] || 0);
                    const changePercent = quote['10. change percent'] || '0.00%';
                    
                    console.log(`[market-dashboard.js] ✅ SUCCESS global quote ${symbol}: $${price.toFixed(2)}`);
                    return {
                        price: price.toFixed(2),
                        change: change.toFixed(2),
                        changePercent: changePercent,
                        volume: parseInt(quote['06. volume'] || 0).toLocaleString(),
                        timestamp: quote['07. latest trading day'],
                        dataType: dataType === 'futures' ? 'futures_quote' : 'index_quote',
                        success: true
                    };
                }
                
                console.log(`[market-dashboard.js] ❌ All methods failed for ${symbol}`);
                return { success: false, error: `No data available for ${symbol}` };
                
            } catch (error) {
                console.error(`[market-dashboard.js] Error fetching ${symbol}:`, error.message);
                return { success: false, error: error.message };
            }
        }

        // === FETCH DATA FOR EACH INDEX ===
        for (const [key, config] of Object.entries(indexConfig)) {
            try {
                let indexData = null;
                let dataSource = '';
                let symbolUsed = '';

                console.log(`[market-dashboard.js] === Processing ${key} for ${marketSession} ===`);

                if (dataStrategy === 'futures' || dataStrategy === 'premarket' || dataStrategy === 'afterhours') {
                    // Use futures contracts for extended hours and futures sessions
                    console.log(`[market-dashboard.js] Using futures contract ${config.futures} for ${key}`);
                    const futuresResult = await fetchRealTimeData(config.futures, 'futures');
                    
                    if (futuresResult.success) {
                        indexData = futuresResult;
                        dataSource = `${config.name} Futures (${config.futures})`;
                        symbolUsed = config.futures;
                        console.log(`[market-dashboard.js] ✅ FUTURES SUCCESS: ${key} = $${indexData.price}`);
                    } else {
                        console.warn(`[market-dashboard.js] ❌ FUTURES FAILED for ${key}: ${futuresResult.error}`);
                    }
                } else if (dataStrategy === 'realtime') {
                    // Use real index during market hours
                    console.log(`[market-dashboard.js] Using real index ${config.live} for ${key}`);
                    const indexResult = await fetchRealTimeData(config.live, 'index');
                    
                    if (indexResult.success) {
                        indexData = indexResult;
                        dataSource = `${config.name} (${config.live})`;
                        symbolUsed = config.live;
                        console.log(`[market-dashboard.js] ✅ INDEX SUCCESS: ${key} = $${indexData.price}`);
                    } else {
                        console.warn(`[market-dashboard.js] ❌ INDEX FAILED for ${key}: ${indexResult.error}`);
                        
                        // Fallback to futures even during market hours if index fails
                        console.log(`[market-dashboard.js] Falling back to futures ${config.futures} for ${key}`);
                        const futuresResult = await fetchRealTimeData(config.futures, 'futures');
                        
                        if (futuresResult.success) {
                            indexData = futuresResult;
                            dataSource = `${config.name} Futures (${config.futures}) - Fallback`;
                            symbolUsed = config.futures;
                            console.log(`[market-dashboard.js] ✅ FALLBACK FUTURES SUCCESS: ${key} = $${indexData.price}`);
                        }
                    }
                }

                if (indexData) {
                    marketData[key] = {
                        symbol: symbolUsed,
                        name: config.name,
                        price: indexData.price,
                        change: indexData.change,
                        changePercent: indexData.changePercent,
                        volume: indexData.volume || 'N/A',
                        timestamp: indexData.timestamp,
                        dataSource: dataSource,
                        dataType: indexData.dataType,
                        marketSession: marketSession,
                        isLive: indexData.dataType.includes('realtime') || indexData.dataType.includes('intraday'),
                        isFutures: symbolUsed.includes('=F'),
                        isExtendedHours: dataStrategy === 'premarket' || dataStrategy === 'afterhours'
                    };
                    
                    console.log(`[market-dashboard.js] ✅ FINAL ${key}: $${indexData.price} via ${dataSource}`);
                } else {
                    console.error(`[market-dashboard.js] ❌ COMPLETE FAILURE: No data for ${key}`);
                    marketData[key] = {
                        error: `No real-time data available for ${config.name}`,
                        name: config.name,
                        marketSession: marketSession,
                        note: 'All data sources failed',
                        attempted: [config.live, config.futures]
                    };
                }
                
                // Rate limiting delay
                await new Promise(resolve => setTimeout(resolve, 400));
                
            } catch (error) {
                console.error(`[market-dashboard.js] Error processing ${key}:`, error.message);
                marketData[key] = {
                    error: `Processing error: ${error.message}`,
                    name: indexConfig[key].name,
                    marketSession: marketSession
                };
            }
        }

        // === VIX VOLATILITY INDEX ===
        try {
            console.log("[market-dashboard.js] Fetching VIX...");
            const vixResult = await fetchRealTimeData('VIX', 'index');
            if (vixResult.success) {
                const vixPrice = parseFloat(vixResult.price);
                marketData.vix = {
                    symbol: 'VIX',
                    name: 'CBOE Volatility Index',
                    price: vixResult.price,
                    change: vixResult.change,
                    changePercent: vixResult.changePercent,
                    timestamp: vixResult.timestamp,
                    level: vixPrice > 30 ? 'Very High' : vixPrice > 25 ? 'High' : vixPrice > 20 ? 'Elevated' : vixPrice > 15 ? 'Normal' : 'Low',
                    interpretation: vixPrice > 25 ? 'Fear/Uncertainty' : vixPrice < 15 ? 'Complacency' : 'Normal',
                    marketSession: marketSession,
                    dataSource: 'CBOE VIX Index',
                    dataType: vixResult.dataType
                };
            }
        } catch (error) {
            console.warn(`[market-dashboard.js] Could not fetch VIX:`, error.message);
        }

        // === ECONOMIC INDICATORS ===
        console.log("[market-dashboard.js] Fetching economic indicators...");
        marketData.economicIndicators = {};
        
        try {
            // 10-Year Treasury Yield
            const treasuryResponse = await fetch(`https://www.alphavantage.co/query?function=TREASURY_YIELD&interval=daily&maturity=10year&apikey=${API_KEY}`);
            const treasuryData = await treasuryResponse.json();
            
            if (treasuryData.data && treasuryData.data.length > 0) {
                const latest = treasuryData.data[0];
                marketData.economicIndicators.treasury10Y = {
                    value: parseFloat(latest.value).toFixed(2),
                    date: latest.date,
                    unit: '%',
                    name: '10-Year Treasury Yield'
                };
            }
            
            // Federal Funds Rate
            const fedResponse = await fetch(`https://www.alphavantage.co/query?function=FEDERAL_FUNDS_RATE&interval=monthly&apikey=${API_KEY}`);
            const fedData = await fedResponse.json();
            
            if (fedData.data && fedData.data.length > 0) {
                const latest = fedData.data[0];
                marketData.economicIndicators.fedFundsRate = {
                    value: parseFloat(latest.value).toFixed(2),
                    date: latest.date,
                    unit: '%',
                    name: 'Federal Funds Rate'
                };
            }
        } catch (error) {
            console.warn(`[market-dashboard.js] Could not fetch economic indicators:`, error.message);
        }

        console.log(`[market-dashboard.js] ✅ Completed fetching comprehensive ${marketSession} market data`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(marketData)
        };

    } catch (error) {
        console.error(`[market-dashboard.js] Unexpected error:`, error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: `Server error while fetching market data: ${error.message}`,
                timestamp: new Date().toISOString()
            })
        };
    }
};
