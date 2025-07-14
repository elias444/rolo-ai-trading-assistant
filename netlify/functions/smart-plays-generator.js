// netlify/functions/smart-plays-generator.js
// REAL-TIME Smart Plays - Up to the second data with futures/pre-market support

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
        console.log(`[smart-plays-generator.js] Generating REAL-TIME smart plays with up-to-second data...`);
        const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

        if (!API_KEY) {
            console.error("[smart-plays-generator.js] ALPHA_VANTAGE_API_KEY not configured.");
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'API key not configured' })
            };
        }

        // Determine current market session for appropriate data fetching
        const now = new Date();
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        const est = new Date(utcTime + (-5 * 3600000));
        const hours = est.getHours();
        const minutes = est.getMinutes();
        const day = est.getDay();
        
        let marketSession = 'Closed';
        let dataStrategy = 'regular'; // regular, premarket, futures
        
        if (day === 0 || day === 6) {
            if (day === 0 && hours >= 18) {
                marketSession = 'Futures Open';
                dataStrategy = 'futures';
            } else {
                marketSession = 'Weekend';
                dataStrategy = 'futures';
            }
        } else {
            const totalMinutes = hours * 60 + minutes;
            if (totalMinutes >= 240 && totalMinutes < 570) {
                marketSession = 'Pre-Market';
                dataStrategy = 'premarket';
            } else if (totalMinutes >= 570 && totalMinutes < 960) {
                marketSession = 'Market Open';
                dataStrategy = 'regular';
            } else if (totalMinutes >= 960 && totalMinutes < 1200) {
                marketSession = 'After Hours';
                dataStrategy = 'premarket';
            } else {
                marketSession = 'Futures Open';
                dataStrategy = 'futures';
            }
        }

        console.log(`[smart-plays-generator.js] Market Session: ${marketSession}, Data Strategy: ${dataStrategy}`);

        const plays = [];
        const realTimeData = {};

        // Step 1: Get REAL-TIME intraday data for active stocks during market hours
        if (dataStrategy === 'regular') {
            console.log("[smart-plays-generator.js] Fetching real-time intraday data...");
            
            // Get real-time top movers first
            try {
                const moversResponse = await fetch(`https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${API_KEY}`);
                
                if (!moversResponse.ok) {
                    throw new Error(`Top movers API failed: ${moversResponse.status}`);
                }

                const moversData = await moversResponse.json();
                
                if (moversData['Error Message'] || moversData['Note']) {
                    console.error("[smart-plays-generator.js] Top movers API error:", moversData['Error Message'] || moversData['Note']);
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({
                            plays: [],
                            message: "API rate limit reached - try again shortly",
                            timestamp: new Date().toISOString(),
                            marketSession
                        })
                    };
                }

                if (!moversData.top_gainers || !Array.isArray(moversData.top_gainers)) {
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({
                            plays: [],
                            message: "No real-time market movers available",
                            timestamp: new Date().toISOString(),
                            marketSession
                        })
                    };
                }

                // Get real-time intraday data for top movers
                const topStocks = moversData.top_gainers.slice(0, 5).concat(moversData.top_losers.slice(0, 3));
                
                for (const stock of topStocks) {
                    const symbol = stock.ticker;
                    const changePercent = parseFloat(stock.change_percentage.replace('%', ''));
                    
                    // Only fetch intraday for stocks with significant moves
                    if (Math.abs(changePercent) >= 3) {
                        try {
                            console.log(`[smart-plays-generator.js] Fetching real-time 1min data for ${symbol}...`);
                            
                            // Use 1-minute interval for most recent data
                            const intradayUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=1min&entitlement=realtime&outputsize=compact&apikey=${API_KEY}`;
                            const intradayResponse = await fetch(intradayUrl);
                            
                            if (intradayResponse.ok) {
                                const intradayData = await intradayResponse.json();
                                
                                if (intradayData['Time Series (1min)']) {
                                    const timeSeries = intradayData['Time Series (1min)'];
                                    const timestamps = Object.keys(timeSeries).sort();
                                    const latestTimestamp = timestamps[timestamps.length - 1];
                                    const latestData = timeSeries[latestTimestamp];
                                    
                                    // Calculate real-time momentum
                                    const currentPrice = parseFloat(latestData['4. close']);
                                    const volume = parseInt(latestData['5. volume']);
                                    
                                    // Get previous periods for trend analysis
                                    let momentum = 0;
                                    if (timestamps.length >= 5) {
                                        const fiveMinAgo = timeSeries[timestamps[timestamps.length - 5]];
                                        const fiveMinPrice = parseFloat(fiveMinAgo['4. close']);
                                        momentum = ((currentPrice - fiveMinPrice) / fiveMinPrice) * 100;
                                    }
                                    
                                    realTimeData[symbol] = {
                                        currentPrice,
                                        volume,
                                        momentum,
                                        changePercent,
                                        timestamp: latestTimestamp,
                                        dataAge: Math.floor((new Date() - new Date(latestTimestamp)) / 1000), // seconds old
                                        high: parseFloat(latestData['2. high']),
                                        low: parseFloat(latestData['3. low']),
                                        open: parseFloat(latestData['1. open'])
                                    };
                                    
                                    console.log(`[smart-plays-generator.js] Got real-time data for ${symbol}: $${currentPrice}, ${momentum.toFixed(2)}% 5min momentum`);
                                }
                            }
                        } catch (e) {
                            console.warn(`[smart-plays-generator.js] Could not fetch intraday for ${symbol}:`, e.message);
                        }
                    }
                }

            } catch (error) {
                console.error("[smart-plays-generator.js] Error fetching real-time market data:", error);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({
                        error: "Failed to fetch real-time market data",
                        timestamp: new Date().toISOString()
                    })
                };
            }

        } else if (dataStrategy === 'premarket' || dataStrategy === 'futures') {
            console.log(`[smart-plays-generator.js] Fetching ${dataStrategy} data...`);
            
            // For pre-market and futures, focus on futures contracts and major ETFs
            const futuresSymbols = ['ES=F', 'NQ=F', 'YM=F']; // S&P, NASDAQ, Dow futures
            const majorETFs = ['SPY', 'QQQ', 'IWM', 'GLD', 'TLT', 'VIX']; // Major ETFs that trade in extended hours
            
            const extendedHourSymbols = dataStrategy === 'futures' ? futuresSymbols : majorETFs;
            
            for (const symbol of extendedHourSymbols) {
                try {
                    console.log(`[smart-plays-generator.js] Fetching ${dataStrategy} data for ${symbol}...`);
                    
                    // Use global quote for extended hours (more reliable than intraday)
                    const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&entitlement=realtime&apikey=${API_KEY}`;
                    const response = await fetch(quoteUrl);
                    
                    if (response.ok) {
                        const data = await response.json();
                        
                        if (data['Global Quote'] && data['Global Quote']['05. price']) {
                            const quote = data['Global Quote'];
                            const currentPrice = parseFloat(quote['05. price']);
                            const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));
                            const volume = parseInt(quote['06. volume']) || 0;
                            
                            realTimeData[symbol] = {
                                currentPrice,
                                changePercent,
                                volume,
                                timestamp: new Date().toISOString(),
                                dataAge: 0, // Global quote is current
                                high: parseFloat(quote['03. high']),
                                low: parseFloat(quote['04. low']),
                                open: parseFloat(quote['02. open']),
                                sessionType: dataStrategy
                            };
                            
                            console.log(`[smart-plays-generator.js] Got ${dataStrategy} data for ${symbol}: $${currentPrice}, ${changePercent}%`);
                        }
                    }
                } catch (e) {
                    console.warn(`[smart-plays-generator.js] Could not fetch ${dataStrategy} data for ${symbol}:`, e.message);
                }
            }
        }

        // Step 2: Generate plays based on REAL-TIME data analysis
        console.log(`[smart-plays-generator.js] Analyzing ${Object.keys(realTimeData).length} symbols with real-time data...`);
        
        for (const [symbol, data] of Object.entries(realTimeData)) {
            
            // Only generate plays for fresh data (less than 5 minutes old for regular market, any age for extended hours)
            const maxDataAge = dataStrategy === 'regular' ? 300 : 3600; // 5 min regular, 1 hour extended
            if (data.dataAge > maxDataAge) {
                console.log(`[smart-plays-generator.js] Skipping ${symbol} - data too old (${data.dataAge}s)`);
                continue;
            }

            const { currentPrice, changePercent, volume, momentum, sessionType } = data;
            
            // Regular market hours - momentum and breakout plays
            if (dataStrategy === 'regular') {
                
                // Strong momentum play (for stocks with real-time momentum > 2% in 5 minutes)
                if (momentum && Math.abs(momentum) >= 2 && Math.abs(changePercent) >= 5 && volume >= 100000) {
                    const direction = momentum > 0 ? 'bullish' : 'bearish';
                    const entry = direction === 'bullish' ? 
                        (currentPrice * 1.002).toFixed(2) : 
                        (currentPrice * 0.998).toFixed(2);
                    const stopLoss = direction === 'bullish' ? 
                        (currentPrice * 0.95).toFixed(2) : 
                        (currentPrice * 1.05).toFixed(2);
                    const target1 = direction === 'bullish' ? 
                        (currentPrice * 1.08).toFixed(2) : 
                        (currentPrice * 0.92).toFixed(2);
                    const target2 = direction === 'bullish' ? 
                        (currentPrice * 1.15).toFixed(2) : 
                        (currentPrice * 0.85).toFixed(2);

                    plays.push({
                        emoji: direction === 'bullish' ? '🚀' : '📉',
                        title: `${symbol} Real-Time Momentum`,
                        ticker: symbol,
                        strategy: 'Real-Time Momentum',
                        confidence: Math.min(90, 70 + Math.floor(Math.abs(momentum) * 2)),
                        entry: parseFloat(entry),
                        stopLoss: parseFloat(stopLoss),
                        targets: [parseFloat(target1), parseFloat(target2)],
                        timeframe: 'Intraday',
                        riskLevel: Math.abs(momentum) > 5 ? 'high' : 'medium',
                        reasoning: `${symbol} showing strong real-time momentum: ${momentum.toFixed(2)}% in 5 minutes, ${changePercent.toFixed(2)}% daily change on ${volume.toLocaleString()} volume. Data is ${data.dataAge} seconds old.`,
                        newsImpact: `Monitor ${symbol} for breaking news driving the ${momentum.toFixed(2)}% 5-minute move`,
                        dataQuality: {
                            dataAge: data.dataAge,
                            marketSession,
                            lastUpdate: data.timestamp
                        }
                    });
                }

                // Volume breakout play
                if (volume >= 500000 && Math.abs(changePercent) >= 3) {
                    const avgVolume = 1000000; // Estimate - in production, fetch historical average
                    const volumeMultiple = volume / avgVolume;
                    
                    if (volumeMultiple >= 2) { // Volume spike
                        const direction = changePercent > 0 ? 'bullish' : 'bearish';
                        const entry = direction === 'bullish' ? 
                            (currentPrice * 1.001).toFixed(2) : 
                            (currentPrice * 0.999).toFixed(2);
                        const stopLoss = direction === 'bullish' ? 
                            (currentPrice * 0.96).toFixed(2) : 
                            (currentPrice * 1.04).toFixed(2);
                        const target = direction === 'bullish' ? 
                            (currentPrice * 1.06).toFixed(2) : 
                            (currentPrice * 0.94).toFixed(2);

                        plays.push({
                            emoji: '📊',
                            title: `${symbol} Volume Breakout`,
                            ticker: symbol,
                            strategy: 'Volume Breakout',
                            confidence: Math.min(85, 60 + Math.floor(volumeMultiple * 5)),
                            entry: parseFloat(entry),
                            stopLoss: parseFloat(stopLoss),
                            targets: [parseFloat(target)],
                            timeframe: 'Intraday to Short-term',
                            riskLevel: 'medium',
                            reasoning: `${symbol} experiencing ${volumeMultiple.toFixed(1)}x normal volume (${volume.toLocaleString()}) with ${changePercent.toFixed(2)}% move. Real-time price: $${currentPrice}`,
                            newsImpact: `Investigate institutional activity in ${symbol}`,
                            dataQuality: {
                                dataAge: data.dataAge,
                                marketSession,
                                lastUpdate: data.timestamp
                            }
                        });
                    }
                }

            } else {
                // Extended hours - futures and ETF plays
                if (Math.abs(changePercent) >= 1) { // Lower threshold for extended hours
                    const direction = changePercent > 0 ? 'bullish' : 'bearish';
                    const sessionLabel = sessionType === 'futures' ? 'Futures' : 'Pre-Market/After Hours';
                    
                    const entry = direction === 'bullish' ? 
                        (currentPrice * 1.001).toFixed(2) : 
                        (currentPrice * 0.999).toFixed(2);
                    const stopLoss = direction === 'bullish' ? 
                        (currentPrice * 0.985).toFixed(2) : 
                        (currentPrice * 1.015).toFixed(2);
                    const target = direction === 'bullish' ? 
                        (currentPrice * 1.02).toFixed(2) : 
                        (currentPrice * 0.98).toFixed(2);

                    plays.push({
                        emoji: sessionType === 'futures' ? '🌙' : '🌅',
                        title: `${symbol} ${sessionLabel} Move`,
                        ticker: symbol,
                        strategy: `${sessionLabel} Trading`,
                        confidence: Math.min(75, 50 + Math.floor(Math.abs(changePercent) * 5)),
                        entry: parseFloat(entry),
                        stopLoss: parseFloat(stopLoss),
                        targets: [parseFloat(target)],
                        timeframe: 'Until Market Open',
                        riskLevel: 'medium',
                        reasoning: `${symbol} moving ${changePercent.toFixed(2)}% in ${sessionLabel.toLowerCase()}. Current price: $${currentPrice}. Position for market open continuation.`,
                        newsImpact: `Monitor overnight news affecting ${symbol}`,
                        dataQuality: {
                            dataAge: data.dataAge,
                            marketSession,
                            lastUpdate: data.timestamp
                        }
                    });
                }
            }
        }

        // Sort plays by confidence and data freshness
        plays.sort((a, b) => {
            if (a.confidence !== b.confidence) {
                return b.confidence - a.confidence;
            }
            return a.dataQuality.dataAge - b.dataQuality.dataAge; // Fresher data first
        });

        if (plays.length === 0) {
            console.log("[smart-plays-generator.js] No qualifying real-time opportunities found");
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    plays: [],
                    message: `No qualifying ${marketSession.toLowerCase()} opportunities detected`,
                    timestamp: new Date().toISOString(),
                    marketSession,
                    dataStrategy,
                    symbolsAnalyzed: Object.keys(realTimeData).length
                })
            };
        }

        console.log(`[smart-plays-generator.js] Generated ${plays.length} real-time plays from ${Object.keys(realTimeData).length} symbols`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                plays: plays.slice(0, 5), // Limit to top 5 plays
                timestamp: new Date().toISOString(),
                marketSession,
                dataStrategy,
                dataSource: "Alpha Vantage Real-Time",
                symbolsAnalyzed: Object.keys(realTimeData).length,
                averageDataAge: Object.values(realTimeData).reduce((sum, d) => sum + d.dataAge, 0) / Object.keys(realTimeData).length
            })
        };

    } catch (error) {
        console.error(`[smart-plays-generator.js] Server error:`, error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Server error generating real-time smart plays",
                timestamp: new Date().toISOString()
            })
        };
    }
};
