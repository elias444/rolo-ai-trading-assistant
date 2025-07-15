// netlify/functions/market-dashboard.js
// FIXED: Working Alpha Vantage symbols and proper data fetching

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
        console.log(`[market-dashboard.js] Starting market data fetch...`);
        const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

        if (!API_KEY) {
            console.error("[market-dashboard.js] ALPHA_VANTAGE_API_KEY not set");
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Alpha Vantage API key not configured' })
            };
        }

        // Market session detection
        const now = new Date();
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        const est = new Date(utcTime + (-5 * 3600000));
        const hours = est.getHours();
        const day = est.getDay();
        const totalMinutes = hours * 60 + est.getMinutes();
        
        let marketSession = 'Market Closed';
        let dataStrategy = 'daily';
        
        if (day === 0 && hours >= 18) { // Sunday 6 PM+
            marketSession = 'Futures Open';
            dataStrategy = 'futures';
        } else if (day === 6) { // Saturday
            marketSession = 'Weekend';
            dataStrategy = 'daily';
        } else if (day >= 1 && day <= 5) { // Monday-Friday
            if (totalMinutes >= 240 && totalMinutes < 570) { // 4:00 AM - 9:30 AM
                marketSession = 'Pre-Market';
                dataStrategy = 'premarket';
            } else if (totalMinutes >= 570 && totalMinutes < 960) { // 9:30 AM - 4:00 PM
                marketSession = 'Market Open';
                dataStrategy = 'realtime';
            } else if (totalMinutes >= 960 && totalMinutes < 1200) { // 4:00 PM - 8:00 PM
                marketSession = 'After Hours';
                dataStrategy = 'afterhours';
            } else if (totalMinutes >= 1080 || totalMinutes < 240) { // 6:00 PM - 4:00 AM
                marketSession = 'Futures Open';
                dataStrategy = 'futures';
            }
        }

        console.log(`[market-dashboard.js] Session: ${marketSession}, Strategy: ${dataStrategy}`);

        const marketData = {
            timestamp: new Date().toISOString(),
            estTime: est.toLocaleString('en-US', { timeZone: 'America/New_York' }),
            marketSession: marketSession,
            dataStrategy: dataStrategy
        };

        // Helper function to fetch data with multiple methods
        async function fetchSymbolData(symbol, symbolName) {
            console.log(`[market-dashboard.js] Fetching ${symbolName} (${symbol})...`);
            
            try {
                // Method 1: Try intraday data first (best for live data)
                if (dataStrategy === 'realtime' || dataStrategy === 'premarket' || dataStrategy === 'afterhours') {
                    const intradayUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=5min&outputsize=compact&apikey=${API_KEY}`;
                    const intradayResponse = await fetch(intradayUrl);
                    const intradayData = await intradayResponse.json();
                    
                    if (intradayData['Time Series (5min)']) {
                        const timeSeries = intradayData['Time Series (5min)'];
                        const timestamps = Object.keys(timeSeries).sort().reverse();
                        
                        if (timestamps.length > 0) {
                            const latest = timeSeries[timestamps[0]];
                            const previous = timestamps.length > 1 ? timeSeries[timestamps[1]] : null;
                            
                            const currentPrice = parseFloat(latest['4. close']);
                            const previousPrice = previous ? parseFloat(previous['4. close']) : parseFloat(latest['1. open']);
                            const change = currentPrice - previousPrice;
                            const changePercent = ((change / previousPrice) * 100).toFixed(2);
                            
                            console.log(`[market-dashboard.js] ✅ Got intraday data for ${symbol}: $${currentPrice.toFixed(2)}`);
                            return {
                                symbol: symbol,
                                name: symbolName,
                                price: currentPrice.toFixed(2),
                                change: change.toFixed(2),
                                changePercent: `${changePercent}%`,
                                volume: parseInt(latest['5. volume'] || 0).toLocaleString(),
                                timestamp: timestamps[0],
                                dataSource: `${symbolName} (Intraday 5min)`,
                                dataType: 'intraday_realtime',
                                marketSession: marketSession,
                                success: true
                            };
                        }
                    }
                }
                
                // Method 2: Try global quote (works for most symbols)
                console.log(`[market-dashboard.js] Trying global quote for ${symbol}...`);
                const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;
                const quoteResponse = await fetch(quoteUrl);
                const quoteData = await quoteResponse.json();
                
                if (quoteData['Global Quote'] && quoteData['Global Quote']['05. price']) {
                    const quote = quoteData['Global Quote'];
                    console.log(`[market-dashboard.js] ✅ Got global quote for ${symbol}: $${quote['05. price']}`);
                    return {
                        symbol: symbol,
                        name: symbolName,
                        price: parseFloat(quote['05. price']).toFixed(2),
                        change: parseFloat(quote['09. change'] || 0).toFixed(2),
                        changePercent: quote['10. change percent'] || '0.00%',
                        volume: parseInt(quote['06. volume'] || 0).toLocaleString(),
                        timestamp: quote['07. latest trading day'],
                        dataSource: `${symbolName} (Global Quote)`,
                        dataType: 'global_quote',
                        marketSession: marketSession,
                        success: true
                    };
                }
                
                // Method 3: Try daily time series as last resort
                console.log(`[market-dashboard.js] Trying daily data for ${symbol}...`);
                const dailyUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${API_KEY}`;
                const dailyResponse = await fetch(dailyUrl);
                const dailyData = await dailyResponse.json();
                
                if (dailyData['Time Series (Daily)']) {
                    const timeSeries = dailyData['Time Series (Daily)'];
                    const dates = Object.keys(timeSeries).sort().reverse();
                    
                    if (dates.length > 0) {
                        const latest = timeSeries[dates[0]];
                        const previous = dates.length > 1 ? timeSeries[dates[1]] : null;
                        
                        const currentPrice = parseFloat(latest['4. close']);
                        const previousPrice = previous ? parseFloat(previous['4. close']) : parseFloat(latest['1. open']);
                        const change = currentPrice - previousPrice;
                        const changePercent = ((change / previousPrice) * 100).toFixed(2);
                        
                        console.log(`[market-dashboard.js] ✅ Got daily data for ${symbol}: $${currentPrice.toFixed(2)}`);
                        return {
                            symbol: symbol,
                            name: symbolName,
                            price: currentPrice.toFixed(2),
                            change: change.toFixed(2),
                            changePercent: `${changePercent}%`,
                            volume: parseInt(latest['5. volume'] || 0).toLocaleString(),
                            timestamp: dates[0],
                            dataSource: `${symbolName} (Daily Close)`,
                            dataType: 'daily_close',
                            marketSession: marketSession,
                            success: true
                        };
                    }
                }
                
                console.warn(`[market-dashboard.js] ❌ All methods failed for ${symbol}`);
                return { success: false, error: `No data available for ${symbol}` };
                
            } catch (error) {
                console.error(`[market-dashboard.js] Error fetching ${symbol}:`, error.message);
                return { success: false, error: error.message };
            }
        }

        // Define symbols to fetch based on market session
        const symbolsToFetch = [];
        
        if (dataStrategy === 'futures') {
            // During futures hours, prioritize futures contracts
            symbolsToFetch.push(
                { symbol: 'ES=F', name: 'S&P 500 Futures', type: 'futures' },
                { symbol: 'NQ=F', name: 'NASDAQ Futures', type: 'futures' },
                { symbol: 'YM=F', name: 'Dow Jones Futures', type: 'futures' },
                { symbol: 'RTY=F', name: 'Russell 2000 Futures', type: 'futures' },
                { symbol: 'SPY', name: 'SPDR S&P 500 ETF', type: 'etf' },
                { symbol: 'QQQ', name: 'Invesco QQQ Trust', type: 'etf' },
                { symbol: 'DIA', name: 'SPDR Dow Jones ETF', type: 'etf' },
                { symbol: 'IWM', name: 'iShares Russell 2000 ETF', type: 'etf' }
            );
        } else {
            // During market hours, try both indices and ETFs
            symbolsToFetch.push(
                // Try real index symbols first
                { symbol: 'SPX', name: 'S&P 500 Index', type: 'index' },
                { symbol: 'IXIC', name: 'NASDAQ Composite', type: 'index' },
                { symbol: 'DJI', name: 'Dow Jones Industrial Average', type: 'index' },
                { symbol: 'RUT', name: 'Russell 2000 Index', type: 'index' },
                // ETF backups
                { symbol: 'SPY', name: 'SPDR S&P 500 ETF', type: 'etf' },
                { symbol: 'QQQ', name: 'Invesco QQQ Trust', type: 'etf' },
                { symbol: 'DIA', name: 'SPDR Dow Jones ETF', type: 'etf' },
                { symbol: 'IWM', name: 'iShares Russell 2000 ETF', type: 'etf' }
            );
        }

        // Fetch data for each symbol
        for (const symbolConfig of symbolsToFetch) {
            const result = await fetchSymbolData(symbolConfig.symbol, symbolConfig.name);
            
            if (result.success) {
                // Organize by logical grouping
                if (symbolConfig.symbol === 'SPX' || symbolConfig.symbol === 'ES=F' || symbolConfig.symbol === 'SPY') {
                    marketData.sp500 = { ...result, type: symbolConfig.type };
                } else if (symbolConfig.symbol === 'IXIC' || symbolConfig.symbol === 'NQ=F' || symbolConfig.symbol === 'QQQ') {
                    marketData.nasdaq = { ...result, type: symbolConfig.type };
                } else if (symbolConfig.symbol === 'DJI' || symbolConfig.symbol === 'YM=F' || symbolConfig.symbol === 'DIA') {
                    marketData.dowJones = { ...result, type: symbolConfig.type };
                } else if (symbolConfig.symbol === 'RUT' || symbolConfig.symbol === 'RTY=F' || symbolConfig.symbol === 'IWM') {
                    marketData.russell2000 = { ...result, type: symbolConfig.type };
                }
            } else {
                console.warn(`[market-dashboard.js] Failed to fetch ${symbolConfig.symbol}: ${result.error}`);
            }
            
            // Rate limiting delay
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Fetch VIX
        console.log(`[market-dashboard.js] Fetching VIX...`);
        const vixResult = await fetchSymbolData('VIX', 'CBOE Volatility Index');
        if (vixResult.success) {
            const vixPrice = parseFloat(vixResult.price);
            marketData.vix = {
                ...vixResult,
                level: vixPrice > 30 ? 'Very High' : vixPrice > 25 ? 'High' : vixPrice > 20 ? 'Elevated' : vixPrice > 15 ? 'Normal' : 'Low',
                interpretation: vixPrice > 25 ? 'Fear/Uncertainty' : vixPrice < 15 ? 'Complacency' : 'Normal'
            };
        }

        // Add basic economic indicators
        try {
            console.log(`[market-dashboard.js] Fetching economic indicators...`);
            
            // 10-Year Treasury
            const treasuryResponse = await fetch(`https://www.alphavantage.co/query?function=TREASURY_YIELD&interval=daily&maturity=10year&apikey=${API_KEY}`);
            const treasuryData = await treasuryResponse.json();
            
            if (treasuryData.data && treasuryData.data.length > 0) {
                marketData.economicIndicators = {
                    treasury10Y: {
                        value: parseFloat(treasuryData.data[0].value).toFixed(2),
                        date: treasuryData.data[0].date,
                        unit: '%',
                        name: '10-Year Treasury Yield'
                    }
                };
            }
        } catch (error) {
            console.warn(`[market-dashboard.js] Could not fetch economic indicators:`, error.message);
        }

        // Check if we got any real data
        const hasData = ['sp500', 'nasdaq', 'dowJones', 'russell2000'].some(key => marketData[key]);
        
        if (!hasData) {
            console.error(`[market-dashboard.js] ❌ NO DATA RETRIEVED - Check API key and rate limits`);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: 'No market data available',
                    details: 'All API calls failed - check API key and rate limits',
                    marketSession: marketSession,
                    timestamp: new Date().toISOString()
                })
            };
        }

        console.log(`[market-dashboard.js] ✅ Successfully fetched market data for ${marketSession}`);
        console.log(`[market-dashboard.js] Data summary:`, {
            sp500: !!marketData.sp500,
            nasdaq: !!marketData.nasdaq,
            dowJones: !!marketData.dowJones,
            russell2000: !!marketData.russell2000,
            vix: !!marketData.vix
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(marketData)
        };

    } catch (error) {
        console.error(`[market-dashboard.js] Critical error:`, error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: `Critical server error: ${error.message}`,
                timestamp: new Date().toISOString()
            })
        };
    }
};
