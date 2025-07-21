// netlify/functions/market-dashboard.js
// FIXED: Market dashboard with working Alpha Vantage symbols and proper data

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
            console.error('[market-dashboard.js] Alpha Vantage API key missing');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Alpha Vantage API key not configured',
                    timestamp: new Date().toISOString()
                })
            };
        }

        // Determine current market session
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const dayOfWeek = now.getDay();
        
        let marketSession = 'CLOSED';
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            marketSession = 'WEEKEND';
        } else if (currentTime >= 930 && currentTime < 1600) {
            marketSession = 'MARKET_OPEN';
        } else if (currentTime >= 400 && currentTime < 930) {
            marketSession = 'PRE_MARKET';
        } else if (currentTime >= 1600 && currentTime < 2000) {
            marketSession = 'AFTER_HOURS';
        } else {
            marketSession = 'FUTURES_OPEN';
        }

        console.log(`[market-dashboard.js] Market session: ${marketSession}`);

        const marketData = {
            session: marketSession,
            timestamp: new Date().toISOString(),
            indices: {},
            economic: {},
            sectors: {},
            vix: null,
            marketMood: 'Unknown'
        };

        // Major Indices - Use ETF symbols that work reliably with Alpha Vantage
        const indices = [
            { symbol: 'SPY', name: 'S&P 500' },
            { symbol: 'QQQ', name: 'NASDAQ' },
            { symbol: 'DIA', name: 'Dow Jones' },
            { symbol: 'IWM', name: 'Russell 2000' }
        ];

        console.log(`[market-dashboard.js] Fetching ${indices.length} major indices...`);

        for (const index of indices) {
            try {
                const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${index.symbol}&apikey=${API_KEY}`;
                console.log(`[market-dashboard.js] Fetching ${index.symbol}...`);
                
                const quoteResponse = await fetch(quoteUrl);
                
                if (!quoteResponse.ok) {
                    console.warn(`[market-dashboard.js] HTTP ${quoteResponse.status} for ${index.symbol}`);
                    continue;
                }
                
                const quoteJson = await quoteResponse.json();
                
                if (quoteJson['Global Quote'] && quoteJson['Global Quote']['01. symbol']) {
                    const quote = quoteJson['Global Quote'];
                    marketData.indices[index.name] = {
                        symbol: index.symbol,
                        price: parseFloat(quote['05. price']),
                        change: parseFloat(quote['09. change']),
                        changePercent: quote['10. change percent'],
                        volume: parseInt(quote['06. volume']),
                        lastUpdated: quote['07. latest trading day']
                    };
                    console.log(`[market-dashboard.js] ✅ Got ${index.name}: $${quote['05. price']} (${quote['10. change percent']})`);
                } else {
                    console.warn(`[market-dashboard.js] No data in response for ${index.symbol}:`, quoteJson);
                }
                
                // Rate limiting - important for Alpha Vantage
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.error(`[market-dashboard.js] Error fetching ${index.symbol}: ${error.message}`);
            }
        }

        // VIX Data - Critical for market sentiment
        try {
            console.log(`[market-dashboard.js] Fetching VIX data...`);
            
            const vixUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VIX&apikey=${API_KEY}`;
            const vixResponse = await fetch(vixUrl);
            
            if (vixResponse.ok) {
                const vixJson = await vixResponse.json();
                
                if (vixJson['Global Quote'] && vixJson['Global Quote']['01. symbol']) {
                    const vixQuote = vixJson['Global Quote'];
                    const vixLevel = parseFloat(vixQuote['05. price']);
                    const vixChange = parseFloat(vixQuote['10. change percent'].replace('%', ''));
                    
                    marketData.vix = vixLevel;
                    
                    // Calculate market mood based on VIX levels
                    if (vixLevel < 12) {
                        marketData.marketMood = 'Complacent';
                    } else if (vixLevel < 16) {
                        marketData.marketMood = 'Low Volatility';
                    } else if (vixLevel < 20) {
                        marketData.marketMood = 'Normal';
                    } else if (vixLevel < 25) {
                        marketData.marketMood = 'Elevated Concern';
                    } else if (vixLevel < 30) {
                        marketData.marketMood = 'Fear';
                    } else {
                        marketData.marketMood = 'Extreme Fear';
                    }
                    
                    console.log(`[market-dashboard.js] ✅ VIX: ${vixLevel} (${marketData.marketMood})`);
                }
            }
        } catch (error) {
            console.error(`[market-dashboard.js] VIX error: ${error.message}`);
        }

        // Economic Indicators - Use symbols that typically work
        const economicSymbols = [
            { symbol: 'DGS10', name: 'Ten Year Treasury', type: 'rate' },
            { symbol: 'FEDFUNDS', name: 'Fed Funds Rate', type: 'rate' },
            { symbol: 'UNRATE', name: 'Unemployment Rate', type: 'rate' }
        ];

        console.log(`[market-dashboard.js] Fetching economic indicators...`);

        for (const econ of economicSymbols) {
            try {
                // Try different function for economic data
                const econUrl = `https://www.alphavantage.co/query?function=FEDERAL_FUNDS_RATE&apikey=${API_KEY}`;
                
                if (econ.symbol === 'FEDFUNDS') {
                    const econResponse = await fetch(econUrl);
                    
                    if (econResponse.ok) {
                        const econJson = await econResponse.json();
                        
                        if (econJson.data && econJson.data.length > 0) {
                            const latestData = econJson.data[0];
                            marketData.economic[econ.name] = {
                                value: parseFloat(latestData.value),
                                date: latestData.date,
                                unit: '%'
                            };
                            console.log(`[market-dashboard.js] ✅ Fed Funds Rate: ${latestData.value}%`);
                        }
                    }
                }
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.warn(`[market-dashboard.js] Economic indicator ${econ.symbol} error: ${error.message}`);
            }
        }

        // Sector ETFs - Key sector performance
        const sectorETFs = [
            { symbol: 'XLK', name: 'Technology' },
            { symbol: 'XLF', name: 'Financials' },
            { symbol: 'XLE', name: 'Energy' },
            { symbol: 'XLV', name: 'Healthcare' },
            { symbol: 'XLI', name: 'Industrials' }
        ];

        console.log(`[market-dashboard.js] Fetching sector performance...`);

        for (const sector of sectorETFs) {
            try {
                const sectorUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${sector.symbol}&apikey=${API_KEY}`;
                const sectorResponse = await fetch(sectorUrl);
                
                if (sectorResponse.ok) {
                    const sectorJson = await sectorResponse.json();
                    
                    if (sectorJson['Global Quote'] && sectorJson['Global Quote']['01. symbol']) {
                        const sectorQuote = sectorJson['Global Quote'];
                        marketData.sectors[sector.name] = {
                            symbol: sector.symbol,
                            price: parseFloat(sectorQuote['05. price']),
                            change: parseFloat(sectorQuote['09. change']),
                            changePercent: sectorQuote['10. change percent']
                        };
                        console.log(`[market-dashboard.js] ✅ ${sector.name}: ${sectorQuote['10. change percent']}`);
                    }
                }
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.warn(`[market-dashboard.js] Sector ${sector.symbol} error: ${error.message}`);
            }
        }

        // Check if we have any real data
        const hasIndices = Object.keys(marketData.indices).length > 0;
        const hasVix = marketData.vix !== null;
        const hasEconomic = Object.keys(marketData.economic).length > 0;
        const hasSectors = Object.keys(marketData.sectors).length > 0;
        
        console.log(`[market-dashboard.js] Data summary - Indices: ${hasIndices}, VIX: ${hasVix}, Economic: ${hasEconomic}, Sectors: ${hasSectors}`);

        if (!hasIndices && !hasVix && !hasEconomic) {
            console.warn(`[market-dashboard.js] No market data successfully fetched`);
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    error: "No real market data available",
                    marketSession: marketSession,
                    timestamp: new Date().toISOString(),
                    dataSource: "Alpha Vantage - No Data"
                })
            };
        }

        console.log(`[market-dashboard.js] ✅ Successfully compiled market dashboard with ${Object.keys(marketData.indices).length} indices, VIX: ${!!hasVix}, Economic: ${Object.keys(marketData.economic).length} indicators`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                ...marketData,
                dataSource: "Alpha Vantage Real-Time Market Data",
                nextUpdate: marketSession === 'MARKET_OPEN' ? '2 minutes' : '5 minutes',
                dataQuality: 'Real-Time'
            })
        };

    } catch (error) {
        console.error('[market-dashboard.js] Unexpected error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Market dashboard error",
                details: error.message,
                timestamp: new Date().toISOString(),
                dataSource: "Error - No Data Available"
            })
        };
    }
};
