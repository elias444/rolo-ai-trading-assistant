// netlify/functions/smart-plays-generator.js
// COMPLETELY REAL DATA ONLY - No mock/fake data whatsoever

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
        console.log(`[smart-plays-generator.js] Fetching ONLY real market data for smart plays...`);
        const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

        if (!API_KEY) {
            console.error("[smart-plays-generator.js] ALPHA_VANTAGE_API_KEY not configured.");
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'API key not configured' })
            };
        }

        // ONLY return plays if we have REAL data from Alpha Vantage
        const plays = [];

        // Step 1: Get REAL top gainers and losers ONLY
        try {
            console.log("[smart-plays-generator.js] Fetching real top gainers/losers...");
            const moversResponse = await fetch(`https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${API_KEY}`);
            
            if (!moversResponse.ok) {
                console.error("[smart-plays-generator.js] Failed to fetch top movers");
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        plays: [],
                        message: "No real market data available",
                        timestamp: new Date().toISOString()
                    })
                };
            }

            const moversData = await moversResponse.json();
            
            // Check for API errors
            if (moversData['Error Message'] || moversData['Note']) {
                console.error("[smart-plays-generator.js] API error:", moversData['Error Message'] || moversData['Note']);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        plays: [],
                        message: "API rate limit or error",
                        timestamp: new Date().toISOString()
                    })
                };
            }

            // Only proceed if we have REAL top gainers data
            if (!moversData.top_gainers || !Array.isArray(moversData.top_gainers) || moversData.top_gainers.length === 0) {
                console.warn("[smart-plays-generator.js] No real top gainers data available");
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        plays: [],
                        message: "No real market movers data available",
                        timestamp: new Date().toISOString()
                    })
                };
            }

            console.log(`[smart-plays-generator.js] Found ${moversData.top_gainers.length} real top gainers`);

            // Generate plays ONLY from REAL top gainers with significant moves
            for (let i = 0; i < Math.min(3, moversData.top_gainers.length); i++) {
                const stock = moversData.top_gainers[i];
                
                // Parse real data
                const ticker = stock.ticker;
                const price = parseFloat(stock.price);
                const changePercent = parseFloat(stock.change_percentage.replace('%', ''));
                const volume = parseInt(stock.volume);

                // Only create plays for stocks with significant REAL moves
                if (changePercent >= 5 && volume >= 100000 && price > 1) {
                    
                    // Calculate realistic entry, stop loss, and targets based on REAL current price
                    const entry = (price * 1.002).toFixed(2); // Enter slightly above current
                    const stopLoss = (price * 0.95).toFixed(2); // 5% stop loss
                    const target1 = (price * 1.08).toFixed(2); // 8% target
                    const target2 = (price * 1.15).toFixed(2); // 15% target

                    plays.push({
                        emoji: '🚀',
                        title: `${ticker} Momentum Play`,
                        ticker: ticker,
                        strategy: 'Momentum Breakout',
                        confidence: Math.min(85, 60 + Math.floor(changePercent / 2)), // Confidence based on real move size
                        entry: parseFloat(entry),
                        stopLoss: parseFloat(stopLoss),
                        targets: [parseFloat(target1), parseFloat(target2)],
                        timeframe: 'Intraday to Short-term',
                        riskLevel: changePercent > 15 ? 'high' : changePercent > 8 ? 'medium' : 'low',
                        reasoning: `${ticker} showing strong momentum with +${changePercent.toFixed(2)}% gain on ${volume.toLocaleString()} volume. Real breakout above resistance levels.`,
                        newsImpact: `Monitor ${ticker} for news catalysts driving the ${changePercent.toFixed(2)}% move`
                    });
                }
            }

            // Generate contrarian plays from REAL top losers (oversold bounces)
            if (moversData.top_losers && Array.isArray(moversData.top_losers) && moversData.top_losers.length > 0) {
                for (let i = 0; i < Math.min(2, moversData.top_losers.length); i++) {
                    const stock = moversData.top_losers[i];
                    
                    const ticker = stock.ticker;
                    const price = parseFloat(stock.price);
                    const changePercent = parseFloat(stock.change_percentage.replace('%', ''));
                    const volume = parseInt(stock.volume);

                    // Only create contrarian plays for significantly oversold stocks
                    if (changePercent <= -8 && volume >= 100000 && price > 2) {
                        
                        const entry = (price * 1.01).toFixed(2); // Enter on bounce
                        const stopLoss = (price * 0.92).toFixed(2); // 8% stop loss
                        const target1 = (price * 1.06).toFixed(2); // 6% target
                        const target2 = (price * 1.12).toFixed(2); // 12% target

                        plays.push({
                            emoji: '🔄',
                            title: `${ticker} Oversold Bounce`,
                            ticker: ticker,
                            strategy: 'Mean Reversion',
                            confidence: Math.min(75, 45 + Math.floor(Math.abs(changePercent) / 3)),
                            entry: parseFloat(entry),
                            stopLoss: parseFloat(stopLoss),
                            targets: [parseFloat(target1), parseFloat(target2)],
                            timeframe: 'Short-term',
                            riskLevel: 'high',
                            reasoning: `${ticker} severely oversold with ${changePercent.toFixed(2)}% decline on ${volume.toLocaleString()} volume. Potential bounce if no fundamental issues.`,
                            newsImpact: `Check for specific negative news causing ${ticker}'s ${changePercent.toFixed(2)}% drop`
                        });
                    }
                }
            }

            console.log(`[smart-plays-generator.js] Generated ${plays.length} plays from real market data`);

        } catch (error) {
            console.error("[smart-plays-generator.js] Error fetching real market data:", error);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: "Failed to fetch real market data",
                    timestamp: new Date().toISOString()
                })
            };
        }

        // ONLY return data if we have REAL plays
        if (plays.length === 0) {
            console.log("[smart-plays-generator.js] No qualifying real market opportunities found");
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    plays: [],
                    message: "No qualifying trading opportunities in current market",
                    timestamp: new Date().toISOString(),
                    dataSource: "Alpha Vantage Real-Time"
                })
            };
        }

        // Return ONLY real data
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                plays: plays,
                timestamp: new Date().toISOString(),
                dataSource: "Alpha Vantage Real-Time",
                totalOpportunities: plays.length
            })
        };

    } catch (error) {
        console.error(`[smart-plays-generator.js] Server error:`, error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Server error generating smart plays",
                timestamp: new Date().toISOString()
            })
        };
    }
};
