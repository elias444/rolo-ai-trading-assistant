// netlify/functions/market-dashboard.js
// Enhanced market dashboard with 24/7 data across all sessions

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
        console.log(`[market-dashboard.js] Fetching comprehensive 24/7 market data...`);
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
                dataStrategy = 'extended';
            } else if (totalMinutes >= 570 && totalMinutes < 960) { // 9:30 AM - 4:00 PM
                marketSession = 'Market Open';
                dataStrategy = 'realtime';
            } else if (totalMinutes >= 960 && totalMinutes < 1200) { // 4:00 PM - 8:00 PM
                marketSession = 'After Hours';
                dataStrategy = 'extended';
            } else if (totalMinutes >= 1080 || totalMinutes < 240) { // 6:00 PM - 4:00 AM
                marketSession = 'Futures Open';
                dataStrategy = 'futures';
            } else {
                marketSession = 'Market Closed';
                dataStrategy = 'daily';
            }
        }

        console.log(`[market-dashboard.js] Current session: ${marketSession}, Strategy: ${dataStrategy}`);

        const marketData = {
            timestamp: new Date().toISOString(),
            estTime: est.toLocaleString(),
            marketSession: marketSession,
            dataStrategy: dataStrategy
        };

        // === MAJOR INDICES DATA ===
        console.log("Fetching major indices data...");
        
        // Define symbols based on market session
        let indexSymbols = {};
        
        if (dataStrategy === 'futures') {
            // Futures contracts and their ETF proxies
            indexSymbols = {
                'sp500': { symbol: 'ES=F', proxy: 'SPY', name: 'S&P 500 Futures' },
                'nasdaq': { symbol: 'NQ=F', proxy: 'QQQ', name: 'NASDAQ Futures' },
                'dowJones': { symbol: 'YM=F', proxy: 'DIA', name: 'Dow Jones Futures' },
                'russell2000': { symbol: 'RTY=F', proxy: 'IWM', name: 'Russell 2000 Futures' }
            };
        } else {
            // Regular market hours or extended hours - use ETFs
            indexSymbols = {
                'sp500': { symbol: 'SPY', proxy: null, name: 'S&P 500 (SPY)' },
                'nasdaq': { symbol: 'QQQ', proxy: null, name: 'NASDAQ 100 (QQQ)' },
                'dowJones': { symbol: 'DIA', proxy: null, name: 'Dow Jones (DIA)' },
                'russell2000': { symbol: 'IWM', proxy: null, name: 'Russell 2000 (IWM)' }
            };
        }

        // Fetch data for each index
        for (const [key, config] of Object.entries(indexSymbols)) {
            try {
                let data = null;
                let dataSource = 'unknown';
                
                // Strategy 1: Try intraday data for real-time/extended hours
                if (dataStrategy === 'realtime' || dataStrategy === 'extended') {
                    const interval = dataStrategy === 'realtime' ? '1min' : '5min';
                    const intradayUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${config.symbol}&interval=${interval}&entitlement=realtime&outputsize=compact&apikey=${API_KEY}`;
                    
                    const intradayResponse = await fetch(intradayUrl);
                    const intradayData = await intradayResponse.json();
                    
                    if (intradayData[`Time Series (${interval})`]) {
                        const timeSeries = intradayData[`Time Series (${interval})`];
                        const timestamps = Object.keys(timeSeries).sort().reverse();
                        
                        if (timestamps.length > 0) {
                            const latest = timeSeries[timestamps[0]];
                            const previous = timestamps.length > 1 ? timeSeries[timestamps[1]] : null;
                            
                            const currentPrice = parseFloat(latest['4. close']);
                            const previousPrice = previous ? parseFloat(previous['4. close']) : parseFloat(latest['1. open']);
                            const change = currentPrice - previousPrice;
                            const changePercent = ((change / previousPrice) * 100).toFixed(2);
                            
                            data = {
                                symbol: config.name,
                                price: currentPrice.toFixed(2),
                                change: change.toFixed(2),
                                changePercent: `${changePercent}%`,
                                volume: parseInt(latest['5. volume'] || 0).toLocaleString(),
                                timestamp: timestamps[0],
                                dataSource: `Intraday ${interval}`
                            };
                            dataSource = `intraday_${interval}`;
                        }
                    }
                }
                
                // Strategy 2: Try futures proxy for futures session
                if (!data && dataStrategy === 'futures' && config.proxy) {
                    console.log(`[market-dashboard.js] Trying futures proxy ${config.proxy} for ${config.symbol}`);
                    
                    const proxyUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${config.proxy}&entitlement=realtime&apikey=${API_KEY}`;
                    const proxyResponse = await fetch(proxyUrl);
                    const proxyData = await proxyResponse.json();
                    
                    if (proxyData['Global Quote'] && proxyData['Global Quote']['05. price']) {
                        const quote = proxyData['Global Quote'];
                        data = {
                            symbol: `${config.name} (via ${config.proxy})`,
                            price: parseFloat(quote['05. price']).toFixed(2),
                            change: parseFloat(quote['09. change'] || 0).toFixed(2),
                            changePercent: quote['10. change percent'] || '0.00%',
                            volume: parseInt(quote['06. volume'] || 0).toLocaleString(),
                            timestamp: quote['07. latest trading day'],
                            dataSource: `Futures Proxy`
                        };
                        dataSource = 'futures_proxy';
                    }
                }
                
                // Strategy 3: Fallback to Global Quote
                if (!data) {
                    const globalUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${config.symbol}&entitlement=realtime&apikey=${API_KEY}`;
                    const globalResponse = await fetch(globalUrl);
                    const globalData = await globalResponse.json();
                    
                    if (globalData['Global Quote'] && globalData['Global Quote']['05. price']) {
                        const quote = globalData['Global Quote'];
                        data = {
                            symbol: config.name,
                            price: parseFloat(quote['05. price']).toFixed(2),
                            change: parseFloat(quote['09. change'] || 0).toFixed(2),
                            changePercent: quote['10. change percent'] || '0.00%',
                            volume: parseInt(quote['06. volume'] || 0).toLocaleString(),
                            timestamp: quote['07. latest trading day'],
                            dataSource: 'Global Quote'
                        };
                        dataSource = 'global_quote';
                    }
                }
                
                if (data) {
                    marketData[key] = {
                        ...data,
                        marketSession: marketSession,
                        fetchStrategy: dataSource
                    };
                    console.log(`[market-dashboard.js] ${key}: $${data.price} (${dataSource})`);
                } else {
                    console.warn(`[market-dashboard.js] No data available for ${key} (${config.symbol})`);
                    marketData[key] = {
                        error: `No data available`,
                        symbol: config.name,
                        marketSession: marketSession
                    };
                }
                
                // Add small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));
                
            } catch (error) {
                console.error(`[market-dashboard.js] Error fetching ${key}:`, error.message);
                marketData[key] = {
                    error: `Fetch error: ${error.message}`,
                    symbol: indexSymbols[key].name,
                    marketSession: marketSession
                };
            }
        }

        // === FUTURES SPECIFIC DATA (when futures are open) ===
        if (dataStrategy === 'futures') {
            console.log("Fetching additional futures data...");
            marketData.futuresSpecific = {};
            
            const futuresContracts = {
                'ES': { symbol: 'ES=F', name: 'E-mini S&P 500' },
                'NQ': { symbol: 'NQ=F', name: 'E-mini NASDAQ' },
                'YM': { symbol: 'YM=F', name: 'E-mini Dow' },
                'GC': { symbol: 'GC=F', name: 'Gold Futures' },
                'CL': { symbol: 'CL=F', name: 'Crude Oil Futures' }
            };
            
            for (const [key, contract] of Object.entries(futuresContracts)) {
                try {
                    // For futures, we'll use Global Quote as many futures aren't directly available
                    const futuresUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${contract.symbol}&apikey=${API_KEY}`;
                    const futuresResponse = await fetch(futuresUrl);
                    const futuresData = await futuresResponse.json();
                    
                    if (futuresData['Global Quote'] && futuresData['Global Quote']['05. price']) {
                        const quote = futuresData['Global Quote'];
                        marketData.futuresSpecific[key] = {
                            symbol: contract.name,
                            price: parseFloat(quote['05. price']).toFixed(2),
                            change: parseFloat(quote['09. change'] || 0).toFixed(2),
                            changePercent: quote['10. change percent'] || '0.00%',
                            dataSource: 'Futures Quote'
                        };
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 200));
                } catch (error) {
                    console.warn(`[market-dashboard.js] Could not fetch futures ${key}:`, error.message);
                }
            }
        }

        // === VOLATILITY AND MARKET INDICATORS ===
        console.log("Fetching market indicators...");
        
        try {
            // VIX
            const vixUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VIX&apikey=${API_KEY}`;
            const vixResponse = await fetch(vixUrl);
            const vixData = await vixResponse.json();
            
            if (vixData['Global Quote'] && vixData['Global Quote']['05. price']) {
                const quote = vixData['Global Quote'];
                const vixPrice = parseFloat(quote['05. price']);
                marketData.vix = {
                    symbol: 'VIX (Volatility Index)',
                    price: vixPrice.toFixed(2),
                    change: parseFloat(quote['09. change'] || 0).toFixed(2),
                    changePercent: quote['10. change percent'] || '0.00%',
                    level: vixPrice > 30 ? 'Very High' : vixPrice > 25 ? 'High' : vixPrice > 20 ? 'Elevated' : vixPrice > 15 ? 'Normal' : 'Low',
                    interpretation: vixPrice > 25 ? 'Fear/Uncertainty' : vixPrice < 15 ? 'Complacency' : 'Normal',
                    marketSession: marketSession
                };
            }
        } catch (error) {
            console.warn(`[market-dashboard.js] Could not fetch VIX:`, error.message);
        }

        // === ECONOMIC INDICATORS ===
        console.log("Fetching economic indicators...");
        marketData.economicIndicators = {};
        
        try {
            // 10-Year Treasury Yield
            const treasuryUrl = `https://www.alphavantage.co/query?function=TREASURY_YIELD&interval=daily&maturity=10year&apikey=${API_KEY}`;
            const treasuryResponse = await fetch(treasuryUrl);
            const treasuryData = await treasuryResponse.json();
            
            if (treasuryData.data && treasuryData.data.length > 0) {
                const latest = treasuryData.data[0];
                marketData.economicIndicators.treasury10Y = {
                    value: parseFloat(latest.value).toFixed(2),
                    date: latest.date,
                    unit: '%',
                    name: '10-Year Treasury'
                };
            }
        } catch (error) {
            console.warn(`[market-dashboard.js] Could not fetch Treasury yield:`, error.message);
        }

        try {
            // Federal Funds Rate
            const fedUrl = `https://www.alphavantage.co/query?function=FEDERAL_FUNDS_RATE&interval=monthly&apikey=${API_KEY}`;
            const fedResponse = await fetch(fedUrl);
            const fedData = await fedResponse.json();
            
            if (fedData.data && fedData.data.length > 0) {
                const latest = fedData.data[0];
                marketData.economicIndicators.fedFundsRate = {
                    value: parseFloat(latest.value).toFixed(2),
                    date: latest.date,
                    unit: '%',
                    name: 'Fed Funds Rate'
                };
            }
        } catch (error) {
            console.warn(`[market-dashboard.js] Could not fetch Fed rate:`, error.message);
        }

        // === DOLLAR INDEX (DXY) ===
        try {
            const dxyUrl = `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=EUR&to_symbol=USD&apikey=${API_KEY}`;
            const dxyResponse = await fetch(dxyUrl);
            const dxyData = await dxyResponse.json();
            
            if (dxyData['Time Series FX (Daily)']) {
                const latestDate = Object.keys(dxyData['Time Series FX (Daily)'])[0];
                const eurUsd = parseFloat(dxyData['Time Series FX (Daily)'][latestDate]['4. close']);
                const dxyApprox = (1 / eurUsd * 100).toFixed(2);
                
                marketData.dollarIndex = {
                    symbol: 'Dollar Index (Approx)',
                    price: dxyApprox,
                    unit: 'index',
                    note: 'Approximated from EUR/USD',
                    marketSession: marketSession
                };
            }
        } catch (error) {
            console.warn(`[market-dashboard.js] Could not fetch Dollar Index:`, error.message);
        }

        // === PRE-MARKET MOVERS (during pre-market) ===
        if (dataStrategy === 'extended' && marketSession === 'Pre-Market') {
            console.log("Fetching pre-market movers...");
            try {
                const moversUrl = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${API_KEY}`;
                const moversResponse = await fetch(moversUrl);
                const moversData = await moversResponse.json();
                
                if (moversData.top_gainers) {
                    marketData.preMarketMovers = {
                        topGainers: moversData.top_gainers.slice(0, 5),
                        topLosers: moversData.top_losers ? moversData.top_losers.slice(0, 5) : [],
                        note: 'Based on latest market close, updated in pre-market'
                    };
                }
            } catch (error) {
                console.warn(`[market-dashboard.js] Could not fetch pre-market movers:`, error.message);
            }
        }

        console.log(`[market-dashboard.js] Successfully fetched comprehensive market data for ${marketSession}`);
        
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
