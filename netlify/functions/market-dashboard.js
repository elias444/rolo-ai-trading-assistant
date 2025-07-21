// netlify/functions/market-dashboard.js
// FIXED: Shows proper index names instead of ETF symbols

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
        const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
        
        if (!API_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Alpha Vantage API key not configured'
                })
            };
        }

        // Market session detection
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

        // FIXED: Use proper index names (what user sees) vs ETF symbols (what we fetch)
        const indices = [
            { symbol: 'SPY', displayName: 'S&P 500' },
            { symbol: 'QQQ', displayName: 'NASDAQ Composite' },
            { symbol: 'DIA', displayName: 'Dow Jones Industrial' },
            { symbol: 'IWM', displayName: 'Russell 2000' }
        ];

        console.log(`Fetching market indices...`);

        // Fetch each index
        for (const index of indices) {
            try {
                const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${index.symbol}&apikey=${API_KEY}`;
                const quoteResponse = await fetch(quoteUrl);
                
                if (quoteResponse.ok) {
                    const quoteJson = await quoteResponse.json();
                    
                    if (quoteJson['Global Quote'] && quoteJson['Global Quote']['01. symbol']) {
                        const quote = quoteJson['Global Quote'];
                        
                        // Use displayName instead of symbol for user-facing display
                        marketData.indices[index.displayName] = {
                            symbol: index.symbol, // Keep original symbol for reference
                            price: parseFloat(quote['05. price']),
                            change: parseFloat(quote['09. change']),
                            changePercent: quote['10. change percent'],
                            volume: parseInt(quote['06. volume']),
                            lastUpdated: quote['07. latest trading day']
                        };
                        
                        console.log(`✅ ${index.displayName}: $${quote['05. price']} (${quote['10. change percent']})`);
                    }
                }
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.error(`Error fetching ${index.displayName}:`, error.message);
            }
        }

        // VIX Data
        try {
            const vixUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VIX&apikey=${API_KEY}`;
            const vixResponse = await fetch(vixUrl);
            
            if (vixResponse.ok) {
                const vixJson = await vixResponse.json();
                
                if (vixJson['Global Quote'] && vixJson['Global Quote']['01. symbol']) {
                    const vixQuote = vixJson['Global Quote'];
                    const vixLevel = parseFloat(vixQuote['05. price']);
                    
                    marketData.vix = vixLevel;
                    
                    // Market mood calculation
                    if (vixLevel < 12) {
                        marketData.marketMood = 'Extremely Complacent';
                    } else if (vixLevel < 16) {
                        marketData.marketMood = 'Low Volatility';
                    } else if (vixLevel < 20) {
                        marketData.marketMood = 'Normal Volatility';
                    } else if (vixLevel < 25) {
                        marketData.marketMood = 'Elevated Concern';
                    } else if (vixLevel < 30) {
                        marketData.marketMood = 'Fear Mode';
                    } else {
                        marketData.marketMood = 'Extreme Fear';
                    }
                    
                    console.log(`✅ VIX: ${vixLevel} (${marketData.marketMood})`);
                }
            }
        } catch (error) {
            console.error('VIX fetch error:', error.message);
        }

        // Add some basic economic indicators
        try {
            // Get Treasury 10Y as economic indicator
            const treasuryUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=TNX&apikey=${API_KEY}`;
            const treasuryResponse = await fetch(treasuryUrl);
            
            if (treasuryResponse.ok) {
                const treasuryJson = await treasuryResponse.json();
                
                if (treasuryJson['Global Quote'] && treasuryJson['Global Quote']['01. symbol']) {
                    const treasuryQuote = treasuryJson['Global Quote'];
                    marketData.economic['10-Year Treasury'] = {
                        value: parseFloat(treasuryQuote['05. price']),
                        change: treasuryQuote['10. change percent'],
                        unit: '%'
                    };
                    console.log(`✅ 10-Year Treasury: ${treasuryQuote['05. price']}%`);
                }
            }
        } catch (error) {
            console.error('Treasury data error:', error.message);
        }

        // Sector performance
        const sectors = [
            { symbol: 'XLK', name: 'Technology' },
            { symbol: 'XLF', name: 'Financial' },
            { symbol: 'XLE', name: 'Energy' },
            { symbol: 'XLV', name: 'Healthcare' }
        ];

        for (const sector of sectors) {
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
                        console.log(`✅ ${sector.name}: ${sectorQuote['10. change percent']}`);
                    }
                }
                
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.error(`Sector ${sector.name} error:`, error.message);
            }
        }

        // Check if we have data
        const hasData = Object.keys(marketData.indices).length > 0 || 
                       marketData.vix !== null || 
                       Object.keys(marketData.economic).length > 0;

        if (!hasData) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    error: "No market data available",
                    marketSession: marketSession,
                    timestamp: new Date().toISOString()
                })
            };
        }

        console.log(`✅ Market dashboard compiled successfully`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                ...marketData,
                dataSource: "Alpha Vantage Real-Time",
                nextUpdate: marketSession === 'MARKET_OPEN' ? '2 minutes' : '5 minutes'
            })
        };

    } catch (error) {
        console.error('Market dashboard error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Market dashboard failed",
                details: error.message
            })
        };
    }
};
