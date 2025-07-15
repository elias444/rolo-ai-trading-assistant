// netlify/functions/market-dashboard.js
// Enhanced market dashboard with REAL index data and live futures/pre-market pricing

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
        console.log(`[market-dashboard.js] Fetching REAL index and futures data...`);
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
            } else {
                marketSession = 'Market Closed';
                dataStrategy = 'daily';
            }
        }

        console.log(`[market-dashboard.js] Session: ${marketSession}, Strategy: ${dataStrategy}`);

        const marketData = {
            timestamp: new Date().toISOString(),
            estTime: est.toLocaleString(),
            marketSession: marketSession,
            dataStrategy: dataStrategy
        };

        // === REAL INDEX DATA FETCHING ===
        
        // Define the REAL index symbols and their futures contracts
        const indexConfig = {
            'sp500': {
                live: '^GSPC',        // S&P 500 Index
                futures: 'ES=F',      // E-mini S&P 500 Futures
                name: 'S&P 500 Index',
                etfBackup: 'SPY'      // Backup if index not available
            },
            'nasdaq': {
                live: '^IXIC',        // NASDAQ Composite Index
                futures: 'NQ=F',      // E-mini NASDAQ Futures
                name: 'NASDAQ Composite',
                etfBackup: 'QQQ'      // Backup if index not available
            },
            'dowJones': {
                live: '^DJI',         // Dow Jones Industrial Average
                futures: 'YM=F',      // E-mini Dow Futures
                name: 'Dow Jones Industrial Average',
                etfBackup: 'DIA'      // Backup if index not available
            },
            'russell2000': {
                live: '^RUT',         // Russell 2000 Index
                futures: 'RTY=F',     // E-mini Russell 2000 Futures
                name: 'Russell 2000 Index',
                etfBackup: 'IWM'      // Backup if index not available
            }
        };

        // Helper function to fetch real-time intraday data
        async function fetchIntradayData(symbol, interval = '1min') {
            try {
                const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=${interval}&entitlement=realtime&outputsize=compact&apikey=${API_KEY}`;
                const response = await fetch(url);
                const data = await response.json();
                
                if (data[`Time Series (${interval})`]) {
                    const timeSeries = data[`Time Series (${interval})`];
                    const timestamps = Object.keys(timeSeries).sort().reverse();
                    
                    if (timestamps.length > 0) {
                        const latest = timeSeries[timestamps[0]];
                        const previous = timestamps.length > 1 ? timeSeries[timestamps[1]] : null;
                        
                        const currentPrice = parseFloat(latest['4. close']);
                        const previousPrice = previous ? parseFloat(previous['4. close']) : parseFloat(latest['1. open']);
                        const change = currentPrice - previousPrice;
                        const changePercent = ((change / previousPrice) * 100).toFixed(2);
                        
                        return {
                            price: currentPrice.toFixed(2),
                            change: change.toFixed(2),
                            changePercent: `${changePercent}%`,
                            volume: parseInt(latest['5. volume'] || 0).toLocaleString(),
                            timestamp: timestamps[0],
                            dataType: `intraday_${interval}`,
                            success: true
                        };
                    }
                }
                return { success: false, error: 'No intraday data available' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        }

        // Helper function to fetch futures data
        async function fetchFuturesData(symbol) {
            try {
                // Try intraday first for real-time futures
                const intradayResult = await fetchIntradayData(symbol, '5min');
                if (intradayResult.success) {
                    return {
                        ...intradayResult,
                        dataType: 'futures_realtime'
                    };
                }
                
                // Fallback to global quote
                const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&entitlement=realtime&apikey=${API_KEY}`;
                const response = await fetch(url);
                const data = await response.json();
                
                if (data['Global Quote'] && data['Global Quote']['05. price']) {
                    const quote = data['Global Quote'];
                    return {
                        price: parseFloat(quote['05. price']).toFixed(2),
                        change: parseFloat(quote['09. change'] || 0).toFixed(2),
                        changePercent: quote['10. change percent'] || '0.00%',
                        volume: parseInt(quote['06. volume'] || 0).toLocaleString(),
                        timestamp: quote['07. latest trading day'],
                        dataType: 'futures_quote',
                        success: true
                    };
                }
                return { success: false, error: 'No futures quote available' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        }

        // Helper function to fetch index data
        async function fetchIndexData(symbol) {
            try {
                // Try intraday first
                const intradayResult = await fetchIntradayData(symbol, '1min');
                if (intradayResult.success) {
                    return {
                        ...intradayResult,
                        dataType: 'index_realtime'
                    };
                }
                
                // Fallback to global quote
                const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&entitlement=realtime&apikey=${API_KEY}`;
                const response = await fetch(url);
                const data = await response.json();
                
                if (data['Global Quote'] && data['Global Quote']['05. price']) {
                    const quote = data['Global Quote'];
                    return {
                        price: parseFloat(quote['05. price']).toFixed(2),
                        change: parseFloat(quote['09. change'] || 0).toFixed(2),
                        changePercent: quote['10. change percent'] || '0.00%',
                        volume: parseInt(quote['06. volume'] || 0).toLocaleString(),
                        timestamp: quote['07. latest trading day'],
                        dataType: 'index_quote',
                        success: true
                    };
                }
                return { success: false, error: 'No index quote available' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        }

        // === FETCH DATA FOR EACH INDEX ===
        for (const [key, config] of Object.entries(indexConfig)) {
            try {
                let indexData = null;
                let dataSource = 'unknown';
                let symbolUsed = 'unknown';

                console.log(`[market-dashboard.js] Fetching ${key} for ${marketSession}...`);

                if (dataStrategy === 'futures') {
                    // FUTURES SESSION: Use futures contracts
                    console.log(`[market-dashboard.js] Trying futures contract ${config.futures} for ${key}`);
                    const futuresResult = await fetchFuturesData(config.futures);
                    
                    if (futuresResult.success) {
                        indexData = futuresResult;
                        dataSource = `${config.name} Futures (${config.futures})`;
                        symbolUsed = config.futures;
                    }
                } else if (dataStrategy === 'realtime' || dataStrategy === 'premarket' || dataStrategy === 'afterhours') {
                    // LIVE/PRE-MARKET/AFTER-HOURS: Try real index first, then futures for extended hours
                    
                    if (dataStrategy === 'realtime') {
                        // During market hours, try real index first
                        console.log(`[market-dashboard.js] Trying real index ${config.live} for ${key}`);
                        const indexResult = await fetchIndexData(config.live);
                        
                        if (indexResult.success) {
                            indexData = indexResult;
                            dataSource = `${config.name} (${config.live})`;
                            symbolUsed = config.live;
                        }
                    }
                    
                    // If index data failed or it's extended hours, try futures
                    if (!indexData) {
                        console.log(`[market-dashboard.js] Trying futures ${config.futures} for extended hours ${key}`);
                        const futuresResult = await fetchFuturesData(config.futures);
                        
                        if (futuresResult.success) {
                            indexData = futuresResult;
                            dataSource = `${config.name} Futures (${config.futures}) - Extended Hours`;
                            symbolUsed = config.futures;
                        }
                    }
                }
                
                // Final fallback to ETF backup
                if (!indexData) {
                    console.log(`[market-dashboard.js] Falling back to ETF ${config.etfBackup} for ${key}`);
                    const etfResult = await fetchIndexData(config.etfBackup);
                    
                    if (etfResult.success) {
                        indexData = etfResult;
                        dataSource = `${config.name} via ${config.etfBackup} ETF (Backup)`;
                        symbolUsed = config.etfBackup;
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
                        isLive: dataStrategy === 'realtime' && indexData.dataType.includes('realtime'),
                        isFutures: symbolUsed.includes('=F'),
                        isExtendedHours: dataStrategy === 'premarket' || dataStrategy === 'afterhours'
                    };
                    
                    console.log(`[market-dashboard.js] ✅ ${key}: ${indexData.price} (${dataSource})`);
                } else {
                    console.warn(`[market-dashboard.js] ❌ No data available for ${key}`);
                    marketData[key] = {
                        error: `No real-time data available for ${config.name}`,
                        name: config.name,
                        marketSession: marketSession,
                        note: 'Check API configuration and market hours'
                    };
                }
                
                // Add delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 300));
                
            } catch (error) {
                console.error(`[market-dashboard.js] Error fetching ${key}:`, error.message);
                marketData[key] = {
                    error: `Fetch error: ${error.message}`,
                    name: indexConfig[key].name,
                    marketSession: marketSession
                };
            }
        }

        // === ADD SEPARATE ETF SECTION ===
        console.log("Fetching major ETFs as separate section...");
        marketData.majorETFs = {};
        
        const etfSymbols = {
            'SPY': 'SPDR S&P 500 ETF',
            'QQQ': 'Invesco QQQ Trust',
            'DIA': 'SPDR Dow Jones Industrial Average ETF',
            'IWM': 'iShares Russell 2000 ETF'
        };
        
        for (const [symbol, name] of Object.entries(etfSymbols)) {
            try {
                const etfResult = await fetchIndexData(symbol);
                if (etfResult.success) {
                    marketData.majorETFs[symbol] = {
                        symbol: symbol,
                        name: name,
                        price: etfResult.price,
                        change: etfResult.change,
                        changePercent: etfResult.changePercent,
                        volume: etfResult.volume,
                        timestamp: etfResult.timestamp,
                        dataSource: `${name} (ETF)`,
                        dataType: etfResult.dataType,
                        marketSession: marketSession
                    };
                }
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                console.warn(`Could not fetch ETF ${symbol}:`, error.message);
            }
        }

        // === VIX VOLATILITY INDEX ===
        try {
            console.log("Fetching VIX volatility data...");
            const vixResult = await fetchIndexData('VIX');
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
            console.warn(`Could not fetch VIX:`, error.message);
        }

        // === ECONOMIC INDICATORS ===
        console.log("Fetching economic indicators...");
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
        } catch (error) {
            console.warn(`Could not fetch Treasury yield:`, error.message);
        }

        try {
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
            console.warn(`Could not fetch Fed rate:`, error.message);
        }

        // === DOLLAR INDEX (DXY) ===
        try {
            const dxyResponse = await fetch(`https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=EUR&to_symbol=USD&apikey=${API_KEY}`);
            const dxyData = await dxyResponse.json();
            
            if (dxyData['Time Series FX (Daily)']) {
                const latestDate = Object.keys(dxyData['Time Series FX (Daily)'])[0];
                const eurUsd = parseFloat(dxyData['Time Series FX (Daily)'][latestDate]['4. close']);
                const dxyApprox = (1 / eurUsd * 100).toFixed(2);
                
                marketData.dollarIndex = {
                    symbol: 'DXY',
                    name: 'US Dollar Index',
                    price: dxyApprox,
                    unit: 'index',
                    note: 'Approximated from EUR/USD',
                    marketSession: marketSession,
                    dataSource: 'Currency Exchange Rate'
                };
            }
        } catch (error) {
            console.warn(`Could not fetch Dollar Index:`, error.message);
        }

        console.log(`[market-dashboard.js] ✅ Successfully fetched comprehensive ${marketSession} market data`);
        
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
