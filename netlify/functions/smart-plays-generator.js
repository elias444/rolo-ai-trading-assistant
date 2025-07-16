// netlify/functions/smart-plays-generator.js
// ZERO MOCK DATA - Only real Alpha Vantage market data

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        console.log('[smart-plays-generator.js] Starting real-time smart plays generation...');
        
        const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
        if (!ALPHA_VANTAGE_API_KEY) {
            throw new Error('Alpha Vantage API key not configured');
        }

        // Determine market session for real-time context
        const now = new Date();
        const easternTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
        const hour = easternTime.getHours();
        const day = easternTime.getDay();
        
        let marketSession, dataFrequency;
        if (day === 0 || day === 6) {
            marketSession = 'WEEKEND';
            dataFrequency = 'WEEKEND_FUTURES';
        } else if (hour >= 4 && hour < 9.5) {
            marketSession = 'PRE_MARKET';
            dataFrequency = 'PRE_MARKET_EXTENDED';
        } else if (hour >= 9.5 && hour < 16) {
            marketSession = 'MARKET_OPEN';
            dataFrequency = 'REAL_TIME_SECONDS';
        } else if (hour >= 16 && hour < 20) {
            marketSession = 'AFTER_HOURS';
            dataFrequency = 'AFTER_HOURS_EXTENDED';
        } else {
            marketSession = 'MARKET_CLOSED';
            dataFrequency = 'FUTURES_OVERNIGHT';
        }

        console.log(`[smart-plays-generator.js] Session: ${marketSession}, Data: ${dataFrequency}`);

        // Fetch REAL top movers from Alpha Vantage
        const topMoversResponse = await fetch(
            `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${ALPHA_VANTAGE_API_KEY}`
        );

        if (!topMoversResponse.ok) {
            throw new Error(`Alpha Vantage API error: ${topMoversResponse.status}`);
        }

        const topMoversData = await topMoversResponse.json();
        
        if (topMoversData.Note || topMoversData.Error) {
            throw new Error(`Alpha Vantage error: ${topMoversData.Note || topMoversData.Error}`);
        }

        if (!topMoversData.top_gainers || !topMoversData.top_losers) {
            console.log('[smart-plays-generator.js] No real market movers available');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    plays: [],
                    message: "No significant market movement detected",
                    marketSession,
                    timestamp: new Date().toISOString(),
                    dataSource: "Alpha Vantage Real-Time Data",
                    reason: "No qualifying real opportunities found"
                })
            };
        }

        // Filter for REAL significant moves only
        const allMovers = [
            ...topMoversData.top_gainers.filter(stock => 
                parseFloat(stock.change_percentage.replace('%', '')) >= 5.0 && 
                parseFloat(stock.volume) >= 100000
            ),
            ...topMoversData.top_losers.filter(stock => 
                Math.abs(parseFloat(stock.change_percentage.replace('%', ''))) >= 5.0 && 
                parseFloat(stock.volume) >= 100000
            )
        ];

        console.log(`[smart-plays-generator.js] Found ${allMovers.length} qualifying real movers`);

        if (allMovers.length === 0) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    plays: [],
                    message: "No qualifying market opportunities",
                    marketSession,
                    timestamp: new Date().toISOString(),
                    dataSource: "Alpha Vantage Real-Time Data",
                    reason: "No stocks meet minimum criteria (5% move, 100K volume)"
                })
            };
        }

        // Get real-time quotes for top movers
        const validPlays = [];
        
        for (const stock of allMovers.slice(0, 8)) { // Analyze top 8 real movers
            try {
                // Fetch REAL current price data
                const quoteResponse = await fetch(
                    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${stock.ticker}&apikey=${ALPHA_VANTAGE_API_KEY}`
                );

                if (quoteResponse.ok) {
                    const quoteData = await quoteResponse.json();
                    const quote = quoteData['Global Quote'];
                    
                    if (quote && quote['05. price']) {
                        const currentPrice = parseFloat(quote['05. price']);
                        const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));
                        const volume = parseInt(quote['06. volume']);
                        
                        // Only create plays with REAL data validation
                        if (Math.abs(changePercent) >= 5.0 && volume >= 100000) {
                            
                            // Calculate REAL entry, stop loss, and targets
                            const isLong = changePercent > 0;
                            let entry, stopLoss, target;
                            
                            if (isLong) {
                                entry = currentPrice * 0.995; // Entry slightly below current
                                stopLoss = currentPrice * 0.95; // 5% stop loss
                                target = currentPrice * 1.08; // 8% target
                            } else {
                                entry = currentPrice * 1.005; // Short entry slightly above current
                                stopLoss = currentPrice * 1.05; // 5% stop loss for short
                                target = currentPrice * 0.92; // 8% target for short
                            }

                            const confidence = Math.min(95, Math.max(60, 
                                60 + (Math.abs(changePercent) - 5) * 3 + (volume / 1000000) * 2
                            ));

                            const play = {
                                id: Math.floor(Math.random() * 10000),
                                emoji: isLong ? "📈" : "📉",
                                title: `${isLong ? 'LONG' : 'SHORT'} ${stock.ticker}`,
                                ticker: stock.ticker,
                                playType: "stock",
                                strategy: isLong ? "momentum" : "reversal",
                                confidence: Math.round(confidence),
                                timeframe: marketSession === 'MARKET_OPEN' ? "intraday" : "swing",
                                entry: {
                                    price: parseFloat(entry.toFixed(2)),
                                    reasoning: `Real-time ${marketSession} entry based on ${Math.abs(changePercent).toFixed(1)}% move`
                                },
                                stopLoss: {
                                    price: parseFloat(stopLoss.toFixed(2)),
                                    reasoning: "5% risk management stop"
                                },
                                targets: [{
                                    price: parseFloat(target.toFixed(2)),
                                    probability: Math.round(confidence * 0.8)
                                }],
                                reasoning: `${stock.ticker} showing ${Math.abs(changePercent).toFixed(1)}% ${isLong ? 'gain' : 'loss'} with ${(volume/1000000).toFixed(1)}M volume. ${isLong ? 'Momentum' : 'Reversal'} play for ${marketSession.toLowerCase()} session.`,
                                realTimeData: {
                                    currentPrice,
                                    changePercent,
                                    volume,
                                    marketSession,
                                    timestamp: new Date().toISOString()
                                }
                            };
                            
                            validPlays.push(play);
                        }
                    }
                }
                
                // Rate limiting for API calls
                await new Promise(resolve => setTimeout(resolve, 250));
                
            } catch (stockError) {
                console.warn(`[smart-plays-generator.js] Could not analyze ${stock.ticker}: ${stockError.message}`);
            }
        }

        // Sort by confidence and return top plays
        validPlays.sort((a, b) => b.confidence - a.confidence);
        
        console.log(`[smart-plays-generator.js] Generated ${validPlays.length} real smart plays`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                plays: validPlays.slice(0, 5), // Top 5 highest confidence plays
                marketSession,
                dataFrequency,
                totalMoversAnalyzed: allMovers.length,
                qualifyingPlays: validPlays.length,
                timestamp: new Date().toISOString(),
                dataSource: "Alpha Vantage Real-Time Market Data",
                nextUpdate: marketSession === 'MARKET_OPEN' ? '60 seconds' : '5 minutes',
                marketContext: {
                    session: marketSession,
                    topGainers: topMoversData.top_gainers.length,
                    topLosers: topMoversData.top_losers.length,
                    activeStocks: topMoversData.most_actively_traded?.length || 0
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
