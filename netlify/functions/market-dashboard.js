// netlify/functions/market-dashboard.js
// Market dashboard with real indices data - ZERO MOCK DATA

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
        console.log(`[market-dashboard.js] Fetching real market data...`);
        
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

        const marketData = {
            session: marketSession,
            timestamp: new Date().toISOString(),
            indices: {},
            economic: {},
            sectors: {},
            vix: null,
            marketMood: 'Unknown'
        };

        // Major Indices - Real data only
        const indices = ['SPY', 'QQQ', 'DIA', 'IWM'];
        const indexNames = {
            'SPY': 'S&P 500',
            'QQQ': 'NASDAQ',
            'DIA': 'Dow Jones',
            'IWM': 'Russell 2000'
        };

        for (const symbol of indices) {
            try {
                const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;
                const quoteResponse = await fetch(quoteUrl);
                const quoteJson = await quoteResponse.json();
                
                if (quoteJson['Global Quote']) {
                    const quote = quoteJson['Global Quote'];
                    marketData.indices[indexNames[symbol]] = {
                        symbol: symbol,
                        price: parseFloat(quote['05. price']),
                        change: parseFloat(quote['09. change']),
                        changePercent: quote['10. change percent'],
                        volume: parseInt(quote['06. volume']),
                        lastUpdated: quote['07. latest trading day']
                    };
                    console.log(`[market-dashboard.js] Got real data for ${symbol}: $${quote['05. price']}`);
                }
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 300));
                
            } catch (error) {
                console.warn(`[market-dashboard.js] Could not fetch ${symbol}: ${error.message}`);
            }
        }

        // VIX Data - Real volatility indicator
        try {
            const vixUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VIX&apikey=${API_KEY}`;
            const vixResponse = await fetch(vixUrl);
            const vixJson = await vixResponse.json();
            
            if (vixJson['Global Quote']) {
                const vixQuote = vixJson['Global Quote'];
                const vixLevel = parseFloat(vixQuote['05. price']);
                const vixChange = parseFloat(vixQuote['10. change percent'].replace('%', ''));
                
                marketData.vix = vixLevel;
                
                // Real market mood based on VIX levels
                if (vixLevel < 15) {
                    marketData.marketMood = 'Complacent';
                } else if (vixLevel < 20) {
                    marketData.marketMood = 'Low Volatility';
                } else if (vixLevel < 25) {
                    marketData.marketMood = 'Elevated Concern';
                } else if (vixLevel < 30) {
                    marketData.marketMood = 'Fear';
                } else {
                    marketData.marketMood = 'Extreme Fear';
                }
                
                console.log(`[market-dashboard.js] VIX: ${vixLevel} (${marketData.marketMood})`);
            }
        } catch (error) {
            console.warn(`[market-dashboard.js] Could not fetch VIX: ${error.message}`);
        }

        // Economic Indicators - Real data when available
        const economicSymbols = [
            { symbol: 'DGS10', name: 'tenYearTreasury' },
            { symbol: 'DFF', name: 'fedFundsRate' },
            { symbol: 'DXY', name: 'dollarIndex' }
        ];

        for (const econ of economicSymbols) {
            try {
                const econUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${econ.symbol}&apikey=${API_KEY}`;
                const econResponse = await fetch(econUrl);
                const econJson = await econResponse.json();
                
                if (econJson['Global Quote']) {
                    const econQuote = econJson['Global Quote'];
                    marketData.economic[econ.name] = {
                        value: parseFloat(econQuote['05. price']),
                        change: econQuote['10. change percent'],
                        lastUpdated: econQuote['07. latest trading day']
                    };
                    console.log(`[market-dashboard.js] Got ${econ.name}: ${econQuote['05. price']}`);
                }
                
                await new Promise(resolve => setTimeout(resolve, 300));
                
            } catch (error) {
                console.warn(`[market-dashboard.js] Could not fetch ${econ.symbol}: ${error.message}`);
            }
        }

        // Sector ETFs - Real sector performance
        const sectorETFs = [
            { symbol: 'XLK', name: 'Technology' },
            { symbol: 'XLF', name: 'Financials' },
            { symbol: 'XLE', name: 'Energy' },
            { symbol: 'XLV', name: 'Healthcare' }
        ];

        for (const sector of sectorETFs) {
            try {
                const sectorUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${sector.symbol}&apikey=${API_KEY}`;
                const sectorResponse = await fetch(sectorUrl);
                const sectorJson = await sectorResponse.json();
                
                if (sectorJson['Global Quote']) {
                    const sectorQuote = sectorJson['Global Quote'];
                    marketData.sectors[sector.name] = {
                        symbol: sector.symbol,
                        price: parseFloat(sectorQuote['05. price']),
                        change: parseFloat(sectorQuote['09. change']),
                        changePercent: sectorQuote['10. change percent']
                    };
                    console.log(`[market-dashboard.js] Got ${sector.name}: ${sectorQuote['10. change percent']}`);
                }
                
                await new Promise(resolve => setTimeout(resolve, 300));
                
            } catch (error) {
                console.warn(`[market-dashboard.js] Could not fetch ${sector.symbol}: ${error.message}`);
            }
        }

        // Only return data if we have real market data
        const hasRealData = Object.keys(marketData.indices).length > 0 || 
                           marketData.vix !== null || 
                           Object.keys(marketData.economic).length > 0;

        if (!hasRealData) {
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

        console.log(`[market-dashboard.js] Successfully compiled market dashboard with ${Object.keys(marketData.indices).length} indices`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                ...marketData,
                dataSource: "Alpha Vantage Real-Time Market Data",
                nextUpdate: marketSession === 'MARKET_OPEN' ? '2 minutes' : '5 minutes'
            })
        };

    } catch (error) {
        console.error('[market-dashboard.js] Error:', error);
        
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
