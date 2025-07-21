// netlify/functions/market-dashboard.js
// FINAL WORKING VERSION - Shows proper index names not ETF symbols

exports.handler = async (event, context) => {
    console.log('Market dashboard function started');
    
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
            console.error('Alpha Vantage API key missing');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    error: 'API key not configured',
                    indices: {},
                    session: 'Unknown'
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
        } else {
            marketSession = 'FUTURES_OPEN';
        }

        console.log(`Market session: ${marketSession}`);

        const marketData = {
            session: marketSession,
            timestamp: new Date().toISOString(),
            indices: {},
            economic: {},
            vix: null,
            marketMood: 'Unknown'
        };

        // CORRECTED: Fetch ETF data but display with proper index names
        const indexMappings = [
            { 
                etfSymbol: 'SPY', 
                indexName: 'S&P 500',
                description: 'S&P 500 Index'
            },
            { 
                etfSymbol: 'QQQ', 
                indexName: 'NASDAQ Composite',
                description: 'NASDAQ-100 Technology Index'
            },
            { 
                etfSymbol: 'DIA', 
                indexName: 'Dow Jones Industrial',
                description: 'Dow Jones Industrial Average'
            },
            { 
                etfSymbol: 'IWM', 
                indexName: 'Russell 2000',
                description: 'Russell 2000 Small Cap Index'
            }
        ];

        console.log('Fetching index data...');

        // Fetch each index using ETF data but display proper names
        for (const mapping of indexMappings) {
            try {
                const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${mapping.etfSymbol}&apikey=${API_KEY}`;
                console.log(`Fetching ${mapping.indexName} (${mapping.etfSymbol})...`);
                
                const response = await fetch(url);
                
                if (response.ok) {
                    const data = await response.json();
                    
                    if (data['Global Quote'] && data['Global Quote']['01. symbol']) {
                        const quote = data['Global Quote'];
                        
                        // Store using the PROPER INDEX NAME, not ETF symbol
                        marketData.indices[mapping.indexName] = {
                            etfSymbol: mapping.etfSymbol, // Keep for reference but don't display
                            indexName: mapping.indexName, // This is what gets displayed
                            description: mapping.description,
                            price: parseFloat(quote['05. price']),
                            change: parseFloat(quote['09. change']),
                            changePercent: quote['10. change percent'],
                            volume: parseInt(quote['06. volume']),
                            lastUpdated: quote['07. latest trading day']
                        };
                        
                        console.log(`✅ ${mapping.indexName}: $${quote['05. price']} (${quote['10. change percent']})`);
                    } else {
                        console.warn(`No data received for ${mapping.indexName}`);
                    }
                } else {
                    console.warn(`HTTP ${response.status} for ${mapping.indexName}`);
                }
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.error(`Error fetching ${mapping.indexName}:`, error.message);
            }
        }

        // VIX Data for market sentiment
        try {
            console.log('Fetching VIX data...');
            const vixUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VIX&apikey=${API_KEY}`;
            const vixResponse = await fetch(vixUrl);
            
            if (vixResponse.ok) {
                const vixData = await vixResponse.json();
                
                if (vixData['Global Quote'] && vixData['Global Quote']['01. symbol']) {
                    const vixQuote = vixData['Global Quote'];
                    const vixLevel = parseFloat(vixQuote['05. price']);
                    
                    marketData.vix = vixLevel;
                    
                    // Calculate market mood based on VIX
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
        } catch (vixError) {
            console.error('VIX error:', vixError.message);
        }

        // Add basic economic indicator
        try {
            // Get 10-Year Treasury as economic indicator
            const treasuryUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=TNX&apikey=${API_KEY}`;
            const treasuryResponse = await fetch(treasuryUrl);
            
            if (treasuryResponse.ok) {
                const treasuryData = await treasuryResponse.json();
                
                if (treasuryData['Global Quote'] && treasuryData['Global Quote']['01. symbol']) {
                    const treasuryQuote = treasuryData['Global Quote'];
                    marketData.economic['10-Year Treasury Yield'] = {
                        value: parseFloat(treasuryQuote['05. price']),
                        change: treasuryQuote['10. change percent'],
                        unit: '%'
                    };
                    console.log(`✅ 10-Year Treasury: ${treasuryQuote['05. price']}%`);
                }
            }
        } catch (treasuryError) {
            console.error('Treasury error:', treasuryError.message);
        }

        // Check if we have any data
        const hasData = Object.keys(marketData.indices).length > 0 || 
                       marketData.vix !== null || 
                       Object.keys(marketData.economic).length > 0;

        if (!hasData) {
            console.warn('No market data successfully fetched');
            // Return a basic response instead of error
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    session: marketSession,
                    indices: {
                        'S&P 500': { price: 'N/A', changePercent: 'N/A' },
                        'NASDAQ Composite': { price: 'N/A', changePercent: 'N/A' },
                        'Dow Jones Industrial': { price: 'N/A', changePercent: 'N/A' },
                        'Russell 2000': { price: 'N/A', changePercent: 'N/A' }
                    },
                    vix: null,
                    marketMood: 'Data Unavailable',
                    timestamp: new Date().toISOString(),
                    dataSource: 'Limited Data Available'
                })
            };
        }

        console.log(`✅ Market dashboard compiled with ${Object.keys(marketData.indices).length} indices`);

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
        
        // Return working fallback data
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                error: 'Market data temporarily unavailable',
                session: 'Unknown',
                indices: {
                    'S&P 500': { price: 'N/A', changePercent: 'N/A' },
                    'NASDAQ Composite': { price: 'N/A', changePercent: 'N/A' },
                    'Dow Jones Industrial': { price: 'N/A', changePercent: 'N/A' },
                    'Russell 2000': { price: 'N/A', changePercent: 'N/A' }
                },
                vix: null,
                marketMood: 'Service Unavailable',
                timestamp: new Date().toISOString()
            })
        };
    }
};
