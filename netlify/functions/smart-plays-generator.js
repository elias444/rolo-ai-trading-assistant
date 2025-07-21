// netlify/functions/smart-plays-generator.js
// FINAL WORKING VERSION - Generates actual trading opportunities

exports.handler = async (event, context) => {
    console.log('Smart plays function started');
    
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
                    plays: [],
                    error: 'API key not configured',
                    timestamp: new Date().toISOString()
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

        console.log(`Market session: ${marketSession}`);

        const plays = [];

        // Strategy 1: Get real top movers from Alpha Vantage
        try {
            console.log('Fetching top gainers and losers...');
            const topMoversUrl = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${API_KEY}`;
            
            const response = await fetch(topMoversUrl);
            
            if (response.ok) {
                const data = await response.json();
                console.log('Top movers data received');
                
                // Process top gainers for momentum plays
                if (data['top_gainers'] && Array.isArray(data['top_gainers'])) {
                    console.log(`Processing ${data['top_gainers'].length} gainers`);
                    
                    for (const stock of data['top_gainers'].slice(0, 5)) {
                        try {
                            const changePercent = parseFloat(stock.change_percent.replace('%', ''));
                            const volume = parseInt(stock.volume);
                            const currentPrice = parseFloat(stock.price);
                            
                            // Only include stocks with significant moves and volume
                            if (changePercent >= 5 && volume >= 500000 && currentPrice >= 1) {
                                const entryPrice = currentPrice;
                                const stopLoss = currentPrice * 0.94; // 6% stop
                                const targetPrice = currentPrice * 1.12; // 12% target
                                const confidence = Math.min(85, 55 + (changePercent * 2));
                                
                                plays.push({
                                    symbol: stock.ticker,
                                    direction: 'LONG',
                                    timeframe: 'Intraday',
                                    entryPrice: parseFloat(entryPrice.toFixed(2)),
                                    stopLoss: parseFloat(stopLoss.toFixed(2)),
                                    targetPrice: parseFloat(targetPrice.toFixed(2)),
                                    confidence: Math.round(confidence),
                                    reasoning: `${stock.ticker} momentum breakout: +${changePercent.toFixed(1)}% with ${(volume/1000000).toFixed(1)}M volume. Strong upward momentum suggests continuation potential above current resistance levels.`,
                                    realTimeData: {
                                        currentPrice: currentPrice,
                                        changePercent: changePercent,
                                        volume: volume,
                                        marketSession: marketSession,
                                        timestamp: new Date().toISOString()
                                    }
                                });
                                
                                console.log(`✅ Added momentum play: ${stock.ticker} +${changePercent.toFixed(1)}%`);
                            }
                        } catch (stockError) {
                            console.warn(`Error processing gainer ${stock.ticker}:`, stockError.message);
                        }
                    }
                }
                
                // Process top losers for bounce plays
                if (data['top_losers'] && Array.isArray(data['top_losers'])) {
                    console.log(`Processing ${data['top_losers'].length} losers`);
                    
                    for (const stock of data['top_losers'].slice(0, 3)) {
                        try {
                            const changePercent = parseFloat(stock.change_percent.replace('%', ''));
                            const volume = parseInt(stock.volume);
                            const currentPrice = parseFloat(stock.price);
                            
                            // Look for oversold bounce opportunities
                            if (changePercent <= -8 && volume >= 1000000 && currentPrice >= 3) {
                                const entryPrice = currentPrice;
                                const stopLoss = currentPrice * 0.90; // 10% stop
                                const targetPrice = currentPrice * 1.15; // 15% bounce target
                                const confidence = Math.min(75, 45 + Math.abs(changePercent));
                                
                                plays.push({
                                    symbol: stock.ticker,
                                    direction: 'LONG',
                                    timeframe: 'Bounce Play',
                                    entryPrice: parseFloat(entryPrice.toFixed(2)),
                                    stopLoss: parseFloat(stopLoss.toFixed(2)),
                                    targetPrice: parseFloat(targetPrice.toFixed(2)),
                                    confidence: Math.round(confidence),
                                    reasoning: `${stock.ticker} oversold bounce setup: ${changePercent.toFixed(1)}% decline with elevated ${(volume/1000000).toFixed(1)}M volume. Potential reversal play from oversold levels with strong volume confirmation.`,
                                    realTimeData: {
                                        currentPrice: currentPrice,
                                        changePercent: changePercent,
                                        volume: volume,
                                        marketSession: marketSession,
                                        timestamp: new Date().toISOString()
                                    }
                                });
                                
                                console.log(`✅ Added bounce play: ${stock.ticker} ${changePercent.toFixed(1)}%`);
                            }
                        } catch (stockError) {
                            console.warn(`Error processing loser ${stock.ticker}:`, stockError.message);
                        }
                    }
                }
                
                // Process most actively traded for volume plays
                if (data['most_actively_traded'] && Array.isArray(data['most_actively_traded'])) {
                    console.log(`Processing ${data['most_actively_traded'].length} active stocks`);
                    
                    for (const stock of data['most_actively_traded'].slice(0, 3)) {
                        try {
                            const changePercent = parseFloat(stock.change_percent.replace('%', ''));
                            const volume = parseInt(stock.volume);
                            const currentPrice = parseFloat(stock.price);
                            
                            // High volume + moderate move = potential continuation
                            if (Math.abs(changePercent) >= 2 && volume >= 10000000 && currentPrice >= 2) {
                                const direction = changePercent > 0 ? 'LONG' : 'SHORT';
                                const entryPrice = currentPrice;
                                const stopLoss = direction === 'LONG' ? 
                                               currentPrice * 0.97 : currentPrice * 1.03;
                                const targetPrice = direction === 'LONG' ? 
                                                  currentPrice * 1.08 : currentPrice * 0.92;
                                const confidence = Math.min(80, 60 + (volume / 1000000));
                                
                                plays.push({
                                    symbol: stock.ticker,
                                    direction: direction,
                                    timeframe: 'Volume Play',
                                    entryPrice: parseFloat(entryPrice.toFixed(2)),
                                    stopLoss: parseFloat(stopLoss.toFixed(2)),
                                    targetPrice: parseFloat(targetPrice.toFixed(2)),
                                    confidence: Math.round(confidence),
                                    reasoning: `${stock.ticker} high-volume ${direction.toLowerCase()} play: ${(volume/1000000).toFixed(1)}M shares traded with ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}% move. Institutional interest suggests continued momentum.`,
                                    realTimeData: {
                                        currentPrice: currentPrice,
                                        changePercent: changePercent,
                                        volume: volume,
                                        marketSession: marketSession,
                                        timestamp: new Date().toISOString()
                                    }
                                });
                                
                                console.log(`✅ Added volume play: ${stock.ticker} ${(volume/1000000).toFixed(1)}M vol`);
                            }
                        } catch (stockError) {
                            console.warn(`Error processing active stock ${stock.ticker}:`, stockError.message);
                        }
                    }
                }
                
            } else {
                console.warn(`Alpha Vantage API returned ${response.status}`);
            }
            
        } catch (topMoversError) {
            console.error('Top movers fetch error:', topMoversError.message);
        }

        // Strategy 2: Index ETF plays during non-market hours
        if (marketSession !== 'MARKET_OPEN') {
            console.log('Adding index plays for off-hours session...');
            
            const indexSymbols = ['SPY', 'QQQ', 'IWM'];
            
            for (const symbol of indexSymbols) {
                try {
                    const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;
                    const quoteResponse = await fetch(quoteUrl);
                    
                    if (quoteResponse.ok) {
                        const quoteData = await quoteResponse.json();
                        
                        if (quoteData['Global Quote']) {
                            const quote = quoteData['Global Quote'];
                            const currentPrice = parseFloat(quote['05. price']);
                            const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));
                            
                            // Generate plays for significant index moves
                            if (Math.abs(changePercent) >= 1) {
                                const direction = changePercent > 0 ? 'LONG' : 'SHORT';
                                const entryPrice = currentPrice;
                                const stopLoss = direction === 'LONG' ? 
                                               currentPrice * 0.995 : currentPrice * 1.005;
                                const targetPrice = direction === 'LONG' ? 
                                                  currentPrice * 1.02 : currentPrice * 0.98;
                                const confidence = Math.min(70, 50 + Math.abs(changePercent) * 8);
                                
                                const indexName = symbol === 'SPY' ? 'S&P 500' : 
                                                symbol === 'QQQ' ? 'NASDAQ' : 'Russell 2000';
                                
                                plays.push({
                                    symbol: symbol,
                                    direction: direction,
                                    timeframe: marketSession.replace('_', '-'),
                                    entryPrice: parseFloat(entryPrice.toFixed(2)),
                                    stopLoss: parseFloat(stopLoss.toFixed(2)),
                                    targetPrice: parseFloat(targetPrice.toFixed(2)),
                                    confidence: Math.round(confidence),
                                    reasoning: `${indexName} ${direction.toLowerCase()} setup during ${marketSession.toLowerCase().replace('_', ' ')} session. ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}% movement suggests ${direction === 'LONG' ? 'bullish' : 'bearish'} sentiment continuation.`,
                                    realTimeData: {
                                        currentPrice: currentPrice,
                                        changePercent: changePercent,
                                        marketSession: marketSession,
                                        timestamp: new Date().toISOString()
                                    }
                                });
                                
                                console.log(`✅ Added index play: ${symbol} ${direction} ${changePercent.toFixed(2)}%`);
                            }
                        }
                    }
                    
                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                } catch (indexError) {
                    console.warn(`Error fetching index ${symbol}:`, indexError.message);
                }
            }
        }

        // Sort plays by confidence and limit to top 5
        plays.sort((a, b) => b.confidence - a.confidence);
        const topPlays = plays.slice(0, 5);

        console.log(`✅ Generated ${topPlays.length} smart plays total`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                plays: topPlays,
                marketSession: marketSession,
                totalOpportunities: plays.length,
                generatedAt: new Date().toISOString(),
                dataSource: "Alpha Vantage Real-Time Market Data",
                nextUpdate: marketSession === 'MARKET_OPEN' ? '30 minutes' : '60 minutes'
            })
        };

    } catch (error) {
        console.error('Smart plays generation error:', error);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                plays: [],
                error: "Smart plays temporarily unavailable",
                details: error.message,
                marketSession: 'Unknown',
                timestamp: new Date().toISOString()
            })
        };
    }
};
