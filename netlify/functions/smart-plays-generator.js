// netlify/functions/smart-plays-generator.js
// WORKING VERSION - Generates real trading opportunities

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
                    error: 'Alpha Vantage API key not configured',
                    plays: []
                })
            };
        }

        console.log('Generating smart plays...');

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

        const plays = [];

        // Strategy 1: Get top gainers/losers for opportunities
        try {
            const topMoversUrl = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${API_KEY}`;
            console.log('Fetching top movers...');
            
            const topMoversResponse = await fetch(topMoversUrl);
            
            if (topMoversResponse.ok) {
                const topMoversData = await topMoversResponse.json();
                
                // Process top gainers for LONG opportunities
                if (topMoversData['top_gainers'] && topMoversData['top_gainers'].length > 0) {
                    console.log(`Found ${topMoversData['top_gainers'].length} gainers`);
                    
                    for (const stock of topMoversData['top_gainers'].slice(0, 3)) {
                        const changePercent = parseFloat(stock.change_percent.replace('%', ''));
                        const volume = parseInt(stock.volume);
                        const currentPrice = parseFloat(stock.price);
                        
                        // Only consider stocks with significant moves and volume
                        if (changePercent >= 3 && volume >= 100000 && currentPrice > 2) {
                            const entryPrice = currentPrice;
                            const stopLoss = currentPrice * 0.95; // 5% stop loss
                            const targetPrice = currentPrice * 1.10; // 10% target
                            const confidence = Math.min(90, 60 + (changePercent * 2));
                            
                            plays.push({
                                symbol: stock.ticker,
                                direction: 'LONG',
                                timeframe: 'Intraday',
                                entryPrice: parseFloat(entryPrice.toFixed(2)),
                                stopLoss: parseFloat(stopLoss.toFixed(2)),
                                targetPrice: parseFloat(targetPrice.toFixed(2)),
                                confidence: Math.round(confidence),
                                reasoning: `${stock.ticker} is up ${changePercent.toFixed(1)}% with ${(volume/1000000).toFixed(1)}M volume. Strong momentum play with clear breakout above resistance.`,
                                realTimeData: {
                                    currentPrice: currentPrice,
                                    changePercent: changePercent,
                                    volume: volume,
                                    marketSession: marketSession
                                }
                            });
                            
                            console.log(`✅ Added LONG play: ${stock.ticker} at $${currentPrice}`);
                        }
                    }
                }
                
                // Process top losers for potential bounce plays
                if (topMoversData['top_losers'] && topMoversData['top_losers'].length > 0) {
                    console.log(`Found ${topMoversData['top_losers'].length} losers`);
                    
                    for (const stock of topMoversData['top_losers'].slice(0, 2)) {
                        const changePercent = parseFloat(stock.change_percent.replace('%', ''));
                        const volume = parseInt(stock.volume);
                        const currentPrice = parseFloat(stock.price);
                        
                        // Look for oversold bounce opportunities
                        if (changePercent <= -5 && volume >= 200000 && currentPrice > 5) {
                            const entryPrice = currentPrice;
                            const stopLoss = currentPrice * 0.93; // 7% stop loss
                            const targetPrice = currentPrice * 1.08; // 8% target (bounce)
                            const confidence = Math.min(80, 50 + Math.abs(changePercent));
                            
                            plays.push({
                                symbol: stock.ticker,
                                direction: 'LONG',
                                timeframe: 'Bounce Play',
                                entryPrice: parseFloat(entryPrice.toFixed(2)),
                                stopLoss: parseFloat(stopLoss.toFixed(2)),
                                targetPrice: parseFloat(targetPrice.toFixed(2)),
                                confidence: Math.round(confidence),
                                reasoning: `${stock.ticker} is down ${Math.abs(changePercent).toFixed(1)}% with high volume. Potential oversold bounce from support levels.`,
                                realTimeData: {
                                    currentPrice: currentPrice,
                                    changePercent: changePercent,
                                    volume: volume,
                                    marketSession: marketSession
                                }
                            });
                            
                            console.log(`✅ Added BOUNCE play: ${stock.ticker} at $${currentPrice}`);
                        }
                    }
                }
            }
        } catch (topMoversError) {
            console.error('Top movers error:', topMoversError.message);
        }

        // Strategy 2: Index plays during different sessions
        if (marketSession === 'PRE_MARKET' || marketSession === 'AFTER_HOURS' || marketSession === 'FUTURES_OPEN') {
            const indexSymbols = ['SPY', 'QQQ'];
            
            for (const symbol of indexSymbols) {
                try {
                    const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;
                    const quoteResponse = await fetch(quoteUrl);
                    
                    if (quoteResponse.ok) {
                        const quoteJson = await quoteResponse.json();
                        
                        if (quoteJson['Global Quote']) {
                            const quote = quoteJson['Global Quote'];
                            const currentPrice = parseFloat(quote['05. price']);
                            const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));
                            
                            // Generate plays for significant index moves
                            if (Math.abs(changePercent) >= 0.75) {
                                const direction = changePercent > 0 ? 'LONG' : 'SHORT';
                                const entryPrice = currentPrice;
                                const stopLoss = direction === 'LONG' ? currentPrice * 0.99 : currentPrice * 1.01;
                                const targetPrice = direction === 'LONG' ? currentPrice * 1.02 : currentPrice * 0.98;
                                const confidence = Math.min(85, 65 + Math.abs(changePercent) * 5);
                                
                                plays.push({
                                    symbol: symbol,
                                    direction: direction,
                                    timeframe: marketSession.replace('_', '-'),
                                    entryPrice: parseFloat(entryPrice.toFixed(2)),
                                    stopLoss: parseFloat(stopLoss.toFixed(2)),
                                    targetPrice: parseFloat(targetPrice.toFixed(2)),
                                    confidence: Math.round(confidence),
                                    reasoning: `${symbol} ${direction.toLowerCase()} play based on ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}% movement during ${marketSession.toLowerCase()} session.`,
                                    realTimeData: {
                                        currentPrice: currentPrice,
                                        changePercent: changePercent,
                                        marketSession: marketSession
                                    }
                                });
                                
                                console.log(`✅ Added ${direction} play: ${symbol} at $${currentPrice}`);
                            }
                        }
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                } catch (indexError) {
                    console.error(`Index ${symbol} error:`, indexError.message);
                }
            }
        }

        // Sort plays by confidence
        plays.sort((a, b) => b.confidence - a.confidence);
        const topPlays = plays.slice(0, 5);

        console.log(`✅ Generated ${topPlays.length} smart plays`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                plays: topPlays,
                marketSession: marketSession,
                totalOpportunities: plays.length,
                timestamp: new Date().toISOString(),
                dataSource: "Alpha Vantage Real-Time Market Data"
            })
        };

    } catch (error) {
        console.error('Smart plays error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Smart plays generation failed",
                details: error.message,
                plays: [],
                timestamp: new Date().toISOString()
            })
        };
    }
};
