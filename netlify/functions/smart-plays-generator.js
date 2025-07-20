// netlify/functions/smart-plays-generator.js
// REAL-TIME Smart Plays - Up to the second data with futures/pre-market support
// ZERO MOCK DATA - Only displays real opportunities or nothing

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
        console.log(`[smart-plays-generator.js] Starting REAL-TIME smart plays generation...`);
        
        const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
        
        if (!API_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Alpha Vantage API key not configured',
                    plays: [], // Always empty array - NO mock data
                    timestamp: new Date().toISOString(),
                    dataSource: "Error - No API Key"
                })
            };
        }
        
        // Determine current market session for real-time strategy
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const dayOfWeek = now.getDay();
        
        let marketSession = 'CLOSED';
        let dataStrategy = '';
        let updateFrequency = '5 minutes';
        
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            marketSession = 'WEEKEND';
            dataStrategy = 'futures_proxies'; // SPY, QQQ pre-market levels
            updateFrequency = '15 minutes';
        } else if (currentTime >= 930 && currentTime < 1600) {
            marketSession = 'MARKET_OPEN';
            dataStrategy = 'realtime_1min'; // Up to the second data
            updateFrequency = '60 seconds';
        } else if (currentTime >= 400 && currentTime < 930) {
            marketSession = 'PRE_MARKET';
            dataStrategy = 'premarket_extended'; // Extended hours data
            updateFrequency = '2 minutes';
        } else if (currentTime >= 1600 && currentTime < 2000) {
            marketSession = 'AFTER_HOURS';
            dataStrategy = 'afterhours_extended'; // Extended hours data
            updateFrequency = '2 minutes';
        } else {
            marketSession = 'FUTURES_OPEN';
            dataStrategy = 'futures_data'; // ES, NQ futures
            updateFrequency = '5 minutes';
        }
        
        console.log(`[smart-plays-generator.js] Market session: ${marketSession}, Strategy: ${dataStrategy}`);
        
        const validPlays = [];
        
        // STRATEGY 1: Real-Time Market Hours (9:30 AM - 4:00 PM ET)
        if (marketSession === 'MARKET_OPEN') {
            console.log(`[smart-plays-generator.js] Fetching REAL-TIME market data...`);
            
            // Get real-time top gainers/losers with up-to-the-second data
            const topMoversUrl = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${API_KEY}`;
            const topMoversResponse = await fetch(topMoversUrl);
            const topMoversData = await topMoversResponse.json();
            
            if (topMoversData['top_gainers'] && topMoversData['top_gainers'].length > 0) {
                // Process top gainers for LONG opportunities
                for (const stock of topMoversData['top_gainers'].slice(0, 10)) {
                    const changePercent = parseFloat(stock.change_percent.replace('%', ''));
                    const volume = parseInt(stock.volume);
                    const currentPrice = parseFloat(stock.price);
                    
                    // STRICT REAL DATA CRITERIA - No mock thresholds
                    if (changePercent >= 5 && volume >= 100000 && currentPrice > 1) {
                        // Get additional real-time data for this stock
                        const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${stock.ticker}&apikey=${API_KEY}`;
                        const quoteResponse = await fetch(quoteUrl);
                        const quoteData = await quoteResponse.json();
                        
                        if (quoteData['Global Quote']) {
                            const quote = quoteData['Global Quote'];
                            const latestPrice = parseFloat(quote['05. price']);
                            const dayHigh = parseFloat(quote['03. high']);
                            const dayLow = parseFloat(quote['04. low']);
                            const prevClose = parseFloat(quote['08. previous close']);
                            
                            // Calculate REAL entry, stop, and target based on actual price action
                            const entryPrice = latestPrice;
                            const resistance = dayHigh;
                            const support = Math.max(dayLow, prevClose * 0.95);
                            const stopLoss = latestPrice * 0.95; // 5% stop
                            const targetPrice = Math.min(resistance, latestPrice * 1.15); // 15% target or resistance
                            
                            // Risk/reward validation using real prices
                            const riskAmount = entryPrice - stopLoss;
                            const rewardAmount = targetPrice - entryPrice;
                            const riskRewardRatio = rewardAmount / riskAmount;
                            
                            if (riskRewardRatio >= 1.5) { // Only good risk/reward plays
                                const confidence = Math.min(95, 60 + (changePercent * 2) + (riskRewardRatio * 5));
                                
                                validPlays.push({
                                    symbol: stock.ticker,
                                    direction: 'LONG',
                                    timeframe: 'Intraday',
                                    entryPrice: parseFloat(entryPrice.toFixed(2)),
                                    stopLoss: parseFloat(stopLoss.toFixed(2)),
                                    targetPrice: parseFloat(targetPrice.toFixed(2)),
                                    confidence: Math.round(confidence),
                                    reasoning: `Real-time breakout play: ${stock.ticker} up ${changePercent.toFixed(1)}% with ${(volume/1000000).toFixed(1)}M volume. Current price $${latestPrice}, targeting $${targetPrice.toFixed(2)} with $${stopLoss.toFixed(2)} stop.`,
                                    dataSource: 'Alpha Vantage Real-Time',
                                    marketSession: marketSession,
                                    realTimeData: {
                                        currentPrice: latestPrice,
                                        changePercent: changePercent,
                                        volume: volume,
                                        dayHigh: dayHigh,
                                        dayLow: dayLow,
                                        riskRewardRatio: parseFloat(riskRewardRatio.toFixed(2)),
                                        lastUpdate: new Date().toISOString()
                                    }
                                });
                            }
                        }
                        
                        // Rate limiting for API calls
                        await new Promise(resolve => setTimeout(resolve, 250));
                    }
                }
            }
        }
        
        // STRATEGY 2: Pre-Market Hours (4:00 AM - 9:30 AM ET)
        else if (marketSession === 'PRE_MARKET') {
            console.log(`[smart-plays-generator.js] Fetching PRE-MARKET data...`);
            
            // Get pre-market movers using extended hours data
            const preMarketSymbols = ['SPY', 'QQQ', 'AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META'];
            
            for (const symbol of preMarketSymbols) {
                try {
                    // Get extended hours data
                    const extendedUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=5min&extended_hours=true&apikey=${API_KEY}`;
                    const extendedResponse = await fetch(extendedUrl);
                    const extendedData = await extendedResponse.json();
                    
                    if (extendedData['Time Series (5min)']) {
                        const timeSeries = extendedData['Time Series (5min)'];
                        const latestTime = Object.keys(timeSeries)[0];
                        const latestData = timeSeries[latestTime];
                        const currentPrice = parseFloat(latestData['4. close']);
                        
                        // Get previous day's close for comparison
                        const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;
                        const quoteResponse = await fetch(quoteUrl);
                        const quoteData = await quoteResponse.json();
                        
                        if (quoteData['Global Quote']) {
                            const prevClose = parseFloat(quoteData['Global Quote']['08. previous close']);
                            const preMarketChange = ((currentPrice - prevClose) / prevClose) * 100;
                            
                            // Only generate plays for significant pre-market moves (>2%)
                            if (Math.abs(preMarketChange) >= 2) {
                                const direction = preMarketChange > 0 ? 'LONG' : 'SHORT';
                                const entryPrice = currentPrice;
                                const stopLoss = direction === 'LONG' ? currentPrice * 0.98 : currentPrice * 1.02;
                                const targetPrice = direction === 'LONG' ? currentPrice * 1.05 : currentPrice * 0.95;
                                const confidence = Math.min(85, 50 + Math.abs(preMarketChange) * 5);
                                
                                validPlays.push({
                                    symbol: symbol,
                                    direction: direction,
                                    timeframe: 'Pre-Market',
                                    entryPrice: parseFloat(entryPrice.toFixed(2)),
                                    stopLoss: parseFloat(stopLoss.toFixed(2)),
                                    targetPrice: parseFloat(targetPrice.toFixed(2)),
                                    confidence: Math.round(confidence),
                                    reasoning: `Pre-market ${direction.toLowerCase()} play: ${symbol} ${preMarketChange > 0 ? 'up' : 'down'} ${Math.abs(preMarketChange).toFixed(1)}% in extended hours. Entry at $${entryPrice.toFixed(2)}.`,
                                    dataSource: 'Alpha Vantage Extended Hours',
                                    marketSession: marketSession,
                                    realTimeData: {
                                        currentPrice: currentPrice,
                                        changePercent: preMarketChange,
                                        previousClose: prevClose,
                                        extendedHoursTime: latestTime,
                                        lastUpdate: new Date().toISOString()
                                    }
                                });
                            }
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                } catch (error) {
                    console.warn(`[smart-plays-generator.js] Could not get pre-market data for ${symbol}: ${error.message}`);
                }
            }
        }
        
        // STRATEGY 3: Futures Hours (6:00 PM - 4:00 AM ET)
        else if (marketSession === 'FUTURES_OPEN') {
            console.log(`[smart-plays-generator.js] Fetching FUTURES data...`);
            
            // Use ETF proxies for futures (ES=SPY, NQ=QQQ, etc.)
            const futuresProxies = [
                { symbol: 'SPY', represents: 'E-mini S&P 500' },
                { symbol: 'QQQ', represents: 'E-mini NASDAQ' },
                { symbol: 'IWM', represents: 'Russell 2000' }
            ];
            
            for (const proxy of futuresProxies) {
                try {
                    // Get the latest available data for futures proxy
                    const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${proxy.symbol}&apikey=${API_KEY}`;
                    const quoteResponse = await fetch(quoteUrl);
                    const quoteData = await quoteResponse.json();
                    
                    if (quoteData['Global Quote']) {
                        const quote = quoteData['Global Quote'];
                        const currentPrice = parseFloat(quote['05. price']);
                        const prevClose = parseFloat(quote['08. previous close']);
                        const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));
                        
                        // Generate futures-based plays only for significant moves (>1%)
                        if (Math.abs(changePercent) >= 1) {
                            const direction = changePercent > 0 ? 'LONG' : 'SHORT';
                            const entryPrice = currentPrice;
                            const stopLoss = direction === 'LONG' ? currentPrice * 0.99 : currentPrice * 1.01;
                            const targetPrice = direction === 'LONG' ? currentPrice * 1.03 : currentPrice * 0.97;
                            const confidence = Math.min(75, 45 + Math.abs(changePercent) * 8);
                            
                            validPlays.push({
                                symbol: proxy.symbol,
                                direction: direction,
                                timeframe: 'Futures Session',
                                entryPrice: parseFloat(entryPrice.toFixed(2)),
                                stopLoss: parseFloat(stopLoss.toFixed(2)),
                                targetPrice: parseFloat(targetPrice.toFixed(2)),
                                confidence: Math.round(confidence),
                                reasoning: `Futures-based ${direction.toLowerCase()} play: ${proxy.symbol} (${proxy.represents} proxy) ${changePercent > 0 ? 'up' : 'down'} ${Math.abs(changePercent).toFixed(1)}% during futures session.`,
                                dataSource: 'Alpha Vantage Futures Proxy',
                                marketSession: marketSession,
                                realTimeData: {
                                    currentPrice: currentPrice,
                                    changePercent: changePercent,
                                    previousClose: prevClose,
                                    futuresProxy: proxy.represents,
                                    lastUpdate: new Date().toISOString()
                                }
                            });
                        }
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 300));
                } catch (error) {
                    console.warn(`[smart-plays-generator.js] Could not get futures data for ${proxy.symbol}: ${error.message}`);
                }
            }
        }
        
        // Sort plays by confidence and return top opportunities
        validPlays.sort((a, b) => b.confidence - a.confidence);
        const topPlays = validPlays.slice(0, 5); // Max 5 plays
        
        console.log(`[smart-plays-generator.js] Generated ${topPlays.length} REAL smart plays for ${marketSession}`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                plays: topPlays, // Only real opportunities or empty array
                marketSession: marketSession,
                dataStrategy: dataStrategy,
                updateFrequency: updateFrequency,
                totalOpportunities: validPlays.length,
                timestamp: new Date().toISOString(),
                dataSource: "Alpha Vantage Real-Time Market Data",
                nextUpdate: marketSession === 'MARKET_OPEN' ? '60 seconds' : updateFrequency,
                marketContext: {
                    session: marketSession,
                    timeStrategy: dataStrategy,
                    dataQuality: 'Real-Time'
                }
            })
        };

    } catch (error) {
        console.error('[smart-plays-generator.js] Error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Smart plays generation error",
                details: error.message,
                plays: [], // Always empty array, never mock data
                timestamp: new Date().toISOString(),
                dataSource: "Error - No Data Available"
            })
        };
    }
};
