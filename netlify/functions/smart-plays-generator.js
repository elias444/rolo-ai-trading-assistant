// netlify/functions/smart-plays-generator.js
// REAL-TIME Smart Plays - Up to the second data with futures/pre-market support
// ABSOLUTELY NO FAKE/MOCK DATA - Only real Alpha Vantage data

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

    const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
    if (!API_KEY) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Alpha Vantage API key not configured",
                plays: [],
                timestamp: new Date().toISOString()
            })
        };
    }

    try {
        console.log(`[smart-plays-generator.js] Starting real-time smart plays generation...`);

        // Determine current market session
        const now = new Date();
        const estTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
        const hour = estTime.getHours();
        const dayOfWeek = estTime.getDay(); // 0 = Sunday, 6 = Saturday
        
        let marketSession = 'CLOSED';
        let dataFrequency = '5min'; // Default
        
        // Market session detection
        if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Monday-Friday
            if (hour >= 4 && hour < 9 || (hour === 9 && estTime.getMinutes() < 30)) {
                marketSession = 'PRE_MARKET';
                dataFrequency = '5min';
            } else if (hour >= 9 && hour < 16 || (hour === 9 && estTime.getMinutes() >= 30)) {
                marketSession = 'MARKET_OPEN';
                dataFrequency = '1min'; // Real-time during market hours
            } else if (hour >= 16 && hour <= 20) {
                marketSession = 'AFTER_HOURS';
                dataFrequency = '5min';
            } else {
                marketSession = 'FUTURES_OPEN';
                dataFrequency = '5min';
            }
        } else if (dayOfWeek === 0 && hour >= 18) { // Sunday evening
            marketSession = 'FUTURES_OPEN';
            dataFrequency = '5min';
        }

        console.log(`[smart-plays-generator.js] Market session: ${marketSession}, Data frequency: ${dataFrequency}`);

        // Fetch real-time top gainers/losers for analysis
        const topMoversUrl = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${API_KEY}`;
        const topMoversResponse = await fetch(topMoversUrl);
        const topMoversData = await topMoversResponse.json();

        if (!topMoversData.top_gainers || !topMoversData.top_losers) {
            console.log(`[smart-plays-generator.js] No real market movers data available`);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    plays: [],
                    marketSession,
                    message: "No qualifying real-time opportunities available",
                    timestamp: new Date().toISOString(),
                    dataSource: "Alpha Vantage - Real Data Only"
                })
            };
        }

        // Get major indices for market context (real-time)
        const indices = ['SPY', 'QQQ', 'IWM'];
        const marketContext = {};
        
        for (const symbol of indices) {
            try {
                const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=${dataFrequency}&apikey=${API_KEY}&outputsize=compact`;
                const response = await fetch(url);
                const data = await response.json();
                
                if (data['Time Series (1min)'] || data['Time Series (5min)']) {
                    const timeSeries = data['Time Series (1min)'] || data['Time Series (5min)'];
                    const latestTime = Object.keys(timeSeries)[0];
                    const latestData = timeSeries[latestTime];
                    
                    marketContext[symbol] = {
                        price: parseFloat(latestData['4. close']),
                        volume: parseInt(latestData['5. volume']),
                        timestamp: latestTime
                    };
                }
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                console.warn(`[smart-plays-generator.js] Could not fetch ${symbol} data: ${error.message}`);
            }
        }

        // Process real market movers for smart plays
        const validPlays = [];
        const allMovers = [...topMoversData.top_gainers, ...topMoversData.top_losers];
        
        for (const stock of allMovers.slice(0, 10)) { // Top 10 movers
            const changePercent = parseFloat(stock.change_percent.replace('%', ''));
            const price = parseFloat(stock.price);
            const volume = parseInt(stock.volume);
            
            // Only create plays for significant moves with real volume
            if (Math.abs(changePercent) >= 5 && volume >= 100000 && price > 1) {
                
                // Fetch detailed intraday data for the stock
                try {
                    const stockUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${stock.ticker}&interval=${dataFrequency}&apikey=${API_KEY}&outputsize=compact`;
                    const stockResponse = await fetch(stockUrl);
                    const stockData = await stockResponse.json();
                    
                    if (stockData['Time Series (1min)'] || stockData['Time Series (5min)']) {
                        const timeSeries = stockData['Time Series (1min)'] || stockData['Time Series (5min)'];
                        const times = Object.keys(timeSeries).slice(0, 20); // Last 20 periods
                        
                        let high = 0, low = 999999, avgVolume = 0;
                        for (const time of times) {
                            const data = timeSeries[time];
                            high = Math.max(high, parseFloat(data['2. high']));
                            low = Math.min(low, parseFloat(data['3. low']));
                            avgVolume += parseInt(data['5. volume']);
                        }
                        avgVolume = avgVolume / times.length;
                        
                        // Only proceed if current volume is significantly above average
                        if (volume > avgVolume * 1.5) {
                            
                            // Determine strategy based on movement and market session
                            let strategy, entry, stopLoss, target, confidence;
                            
                            if (changePercent > 5) { // Strong gainer
                                if (marketSession === 'MARKET_OPEN') {
                                    strategy = "Momentum Continuation";
                                    entry = price;
                                    stopLoss = price * 0.95; // 5% stop
                                    target = price * 1.10; // 10% target
                                    confidence = Math.min(85, 60 + (changePercent * 2));
                                } else {
                                    strategy = "Gap Up Follow-Through";
                                    entry = price;
                                    stopLoss = price * 0.97; // Tighter stop after hours
                                    target = price * 1.08;
                                    confidence = Math.min(75, 50 + (changePercent * 1.5));
                                }
                            } else if (changePercent < -5) { // Strong loser
                                strategy = "Oversold Bounce";
                                entry = price;
                                stopLoss = price * 0.92; // 8% stop
                                target = price * 1.15; // 15% bounce target
                                confidence = Math.min(80, 55 + (Math.abs(changePercent) * 1.8));
                            }
                            
                            const play = {
                                id: `${stock.ticker}_${Date.now()}`,
                                ticker: stock.ticker,
                                title: `${strategy} - ${stock.ticker}`,
                                strategy,
                                type: changePercent > 0 ? "LONG" : "BOUNCE",
                                entry: parseFloat(entry.toFixed(2)),
                                stopLoss: parseFloat(stopLoss.toFixed(2)),
                                target: parseFloat(target.toFixed(2)),
                                confidence: Math.round(confidence),
                                currentPrice: price,
                                changePercent: changePercent,
                                volume: volume,
                                avgVolume: Math.round(avgVolume),
                                volumeRatio: parseFloat((volume / avgVolume).toFixed(1)),
                                marketSession,
                                dataTimestamp: new Date().toISOString(),
                                reasoning: `${stock.ticker} showing ${Math.abs(changePercent).toFixed(1)}% move with ${(volume/1000000).toFixed(1)}M volume (${(volume/avgVolume).toFixed(1)}x average). ${strategy} setup based on real-time ${marketSession} conditions.`,
                                riskReward: parseFloat(((target - entry) / (entry - stopLoss)).toFixed(2))
                            };
                            
                            validPlays.push(play);
                        }
                    }
                    
                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 300));
                    
                } catch (stockError) {
                    console.warn(`[smart-plays-generator.js] Could not analyze ${stock.ticker}: ${stockError.message}`);
                }
            }
        }

        // Sort by confidence and volume ratio
        validPlays.sort((a, b) => (b.confidence * b.volumeRatio) - (a.confidence * a.volumeRatio));
        
        console.log(`[smart-plays-generator.js] Generated ${validPlays.length} real smart plays from ${allMovers.length} market movers`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                plays: validPlays.slice(0, 5), // Top 5 highest quality plays
                marketSession,
                marketContext,
                dataFrequency,
                totalMoversAnalyzed: allMovers.length,
                qualifyingPlays: validPlays.length,
                timestamp: new Date().toISOString(),
                dataSource: "Alpha Vantage Real-Time Data",
                nextUpdate: marketSession === 'MARKET_OPEN' ? '1 minute' : '5 minutes'
            })
        };

    } catch (error) {
        console.error(`[smart-plays-generator.js] Error:`, error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Smart plays generation error",
                details: error.message,
                plays: [],
                timestamp: new Date().toISOString(),
                dataSource: "Error - No Data Available"
            })
        };
    }
};
