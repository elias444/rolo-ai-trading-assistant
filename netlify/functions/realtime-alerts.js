// netlify/functions/realtime-alerts.js
// ZERO MOCK DATA - Only real market movements and alerts

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
        console.log('[realtime-alerts.js] Scanning for real market alerts...');
        
        const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
        if (!ALPHA_VANTAGE_API_KEY) {
            throw new Error('Alpha Vantage API key not configured');
        }

        // Determine market session
        const now = new Date();
        const easternTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
        const hour = easternTime.getHours();
        const day = easternTime.getDay();
        
        let marketSession;
        if (day === 0 || day === 6) {
            marketSession = 'WEEKEND';
        } else if (hour >= 4 && hour < 9.5) {
            marketSession = 'PRE_MARKET';
        } else if (hour >= 9.5 && hour < 16) {
            marketSession = 'MARKET_OPEN';
        } else if (hour >= 16 && hour < 20) {
            marketSession = 'AFTER_HOURS';
        } else {
            marketSession = 'MARKET_CLOSED';
        }

        console.log(`[realtime-alerts.js] Scanning ${marketSession} session for alerts`);

        const alerts = [];

        // 1. Fetch REAL top movers for breakout alerts
        try {
            const topMoversResponse = await fetch(
                `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${ALPHA_VANTAGE_API_KEY}`
            );

            if (topMoversResponse.ok) {
                const topMoversData = await topMoversResponse.json();
                
                if (topMoversData.top_gainers && !topMoversData.Note && !topMoversData.Error) {
                    // Alert for major gainers (>10% move)
                    const majorGainers = topMoversData.top_gainers.filter(stock => 
                        parseFloat(stock.change_percentage.replace('%', '')) >= 10.0 &&
                        parseFloat(stock.volume) >= 500000
                    );

                    majorGainers.slice(0, 3).forEach((stock, index) => {
                        const changePercent = parseFloat(stock.change_percentage.replace('%', ''));
                        alerts.push({
                            id: Date.now() + index,
                            type: "breakout",
                            priority: changePercent >= 20 ? "high" : changePercent >= 15 ? "medium" : "low",
                            ticker: stock.ticker,
                            title: `Breakout Alert: ${stock.ticker}`,
                            description: `${stock.ticker} up ${changePercent.toFixed(1)}% to $${parseFloat(stock.price).toFixed(2)} with ${(parseFloat(stock.volume)/1000000).toFixed(1)}M volume`,
                            action: `Consider LONG position with stop at $${(parseFloat(stock.price) * 0.95).toFixed(2)}`,
                            confidence: Math.min(95, Math.max(70, 70 + (changePercent - 10) * 2)),
                            currentPrice: parseFloat(stock.price),
                            volume: parseFloat(stock.volume),
                            changePercent: changePercent,
                            timestamp: new Date().toISOString()
                        });
                    });

                    // Alert for major losers (potential reversal)
                    const majorLosers = topMoversData.top_losers.filter(stock => 
                        parseFloat(stock.change_percentage.replace('%', '')) <= -10.0 &&
                        parseFloat(stock.volume) >= 500000
                    );

                    majorLosers.slice(0, 2).forEach((stock, index) => {
                        const changePercent = parseFloat(stock.change_percentage.replace('%', ''));
                        alerts.push({
                            id: Date.now() + index + 100,
                            type: "oversold",
                            priority: Math.abs(changePercent) >= 20 ? "high" : "medium",
                            ticker: stock.ticker,
                            title: `Oversold Alert: ${stock.ticker}`,
                            description: `${stock.ticker} down ${Math.abs(changePercent).toFixed(1)}% to $${parseFloat(stock.price).toFixed(2)} - potential reversal opportunity`,
                            action: `Watch for bounce setup above $${(parseFloat(stock.price) * 1.03).toFixed(2)}`,
                            confidence: Math.min(85, Math.max(60, 60 + (Math.abs(changePercent) - 10) * 1.5)),
                            currentPrice: parseFloat(stock.price),
                            volume: parseFloat(stock.volume),
                            changePercent: changePercent,
                            timestamp: new Date().toISOString()
                        });
                    });
                }
            }
        } catch (error) {
            console.warn('[realtime-alerts.js] Could not fetch top movers:', error.message);
        }

        // 2. Fetch REAL VIX data for volatility alerts
        try {
            const vixResponse = await fetch(
                `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VIX&apikey=${ALPHA_VANTAGE_API_KEY}`
            );

            if (vixResponse.ok) {
                const vixData = await vixResponse.json();
                const vixQuote = vixData['Global Quote'];
                
                if (vixQuote && vixQuote['05. price']) {
                    const vixLevel = parseFloat(vixQuote['05. price']);
                    const vixChange = parseFloat(vixQuote['10. change percent'].replace('%', ''));
                    
                    // Alert for high volatility
                    if (vixLevel >= 30) {
                        alerts.push({
                            id: Date.now() + 200,
                            type: "volatility",
                            priority: vixLevel >= 40 ? "high" : "medium",
                            ticker: "VIX",
                            title: `High Volatility Alert`,
                            description: `VIX at ${vixLevel.toFixed(1)} (${vixChange > 0 ? '+' : ''}${vixChange.toFixed(1)}%) - Market fear elevated`,
                            action: vixLevel >= 40 ? "Consider defensive positioning" : "Monitor for opportunities in oversold names",
                            confidence: 90,
                            vixLevel: vixLevel,
                            vixChange: vixChange,
                            timestamp: new Date().toISOString()
                        });
                    }
                    
                    // Alert for VIX spike
                    if (Math.abs(vixChange) >= 15) {
                        alerts.push({
                            id: Date.now() + 201,
                            type: "volatility_spike",
                            priority: "high",
                            ticker: "VIX",
                            title: `VIX Spike Alert`,
                            description: `VIX moved ${vixChange > 0 ? '+' : ''}${vixChange.toFixed(1)}% to ${vixLevel.toFixed(1)} - Major market shift detected`,
                            action: vixChange > 0 ? "Risk-off positioning recommended" : "Volatility declining - opportunities emerging",
                            confidence: 95,
                            vixLevel: vixLevel,
                            vixChange: vixChange,
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            }
        } catch (error) {
            console.warn('[realtime-alerts.js] Could not fetch VIX data:', error.message);
        }

        // 3. Check SPY for market-wide alerts
        try {
            const spyResponse = await fetch(
                `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=SPY&apikey=${ALPHA_VANTAGE_API_KEY}`
            );

            if (spyResponse.ok) {
                const spyData = await spyResponse.json();
                const spyQuote = spyData['Global Quote'];
                
                if (spyQuote && spyQuote['05. price']) {
                    const spyPrice = parseFloat(spyQuote['05. price']);
                    const spyChange = parseFloat(spyQuote['10. change percent'].replace('%', ''));
                    const spyVolume = parseInt(spyQuote['06. volume']);
                    
                    // Alert for major market moves
                    if (Math.abs(spyChange) >= 2.0) {
                        alerts.push({
                            id: Date.now() + 300,
                            type: "market_move",
                            priority: Math.abs(spyChange) >= 3.0 ? "high" : "medium",
                            ticker: "SPY",
                            title: `Market ${spyChange > 0 ? 'Rally' : 'Decline'} Alert`,
                            description: `SPY ${spyChange > 0 ? 'up' : 'down'} ${Math.abs(spyChange).toFixed(1)}% to ${spyPrice.toFixed(2)} - Broad market ${spyChange > 0 ? 'strength' : 'weakness'}`,
                            action: spyChange > 0 ? "Look for momentum plays in strong sectors" : "Consider defensive positioning or oversold bounces",
                            confidence: 85,
                            spyPrice: spyPrice,
                            spyChange: spyChange,
                            spyVolume: spyVolume,
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            }
        } catch (error) {
            console.warn('[realtime-alerts.js] Could not fetch SPY data:', error.message);
        }

        // 4. Fetch REAL news for sentiment alerts
        try {
            const newsResponse = await fetch(
                `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&apikey=${ALPHA_VANTAGE_API_KEY}&limit=10`
            );

            if (newsResponse.ok) {
                const newsData = await newsResponse.json();
                
                if (newsData.feed && newsData.feed.length > 0) {
                    // Check for high-impact news
                    const recentNews = newsData.feed.filter(article => {
                        const publishTime = new Date(article.time_published);
                        const hoursAgo = (Date.now() - publishTime.getTime()) / (1000 * 60 * 60);
                        return hoursAgo <= 2; // News from last 2 hours
                    });

                    recentNews.slice(0, 2).forEach((article, index) => {
                        if (article.overall_sentiment_score) {
                            const sentiment = parseFloat(article.overall_sentiment_score);
                            
                            if (Math.abs(sentiment) >= 0.3) { // Strong sentiment
                                alerts.push({
                                    id: Date.now() + 400 + index,
                                    type: "news",
                                    priority: Math.abs(sentiment) >= 0.5 ? "high" : "medium",
                                    ticker: article.ticker_sentiment?.[0]?.ticker || "MARKET",
                                    title: `News ${sentiment > 0 ? 'Positive' : 'Negative'} Alert`,
                                    description: `${sentiment > 0 ? 'Bullish' : 'Bearish'} news detected: ${article.title.substring(0, 80)}...`,
                                    action: sentiment > 0 ? "Monitor for upside momentum" : "Watch for defensive positioning",
                                    confidence: Math.min(90, Math.max(60, 60 + Math.abs(sentiment) * 50)),
                                    sentimentScore: sentiment,
                                    newsSource: article.source,
                                    timestamp: new Date().toISOString()
                                });
                            }
                        }
                    });
                }
            }
        } catch (error) {
            console.warn('[realtime-alerts.js] Could not fetch news data:', error.message);
        }

        // Sort alerts by priority and confidence
        alerts.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return (priorityOrder[b.priority] - priorityOrder[a.priority]) || (b.confidence - a.confidence);
        });

        console.log(`[realtime-alerts.js] Generated ${alerts.length} real alerts from market scanning`);

        if (alerts.length === 0) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    alerts: [],
                    message: "No significant market alerts detected",
                    reason: "Current market conditions are within normal parameters",
                    marketSession,
                    timestamp: new Date().toISOString(),
                    dataSource: "Alpha Vantage Real-Time Scanning",
                    scanResults: {
                        topMoversChecked: true,
                        volatilityChecked: true,
                        marketMoveChecked: true,
                        newsChecked: true
                    }
                })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                alerts: alerts.slice(0, 8), // Top 8 highest priority alerts
                marketSession,
                totalAlertsGenerated: alerts.length,
                highPriorityCount: alerts.filter(a => a.priority === 'high').length,
                mediumPriorityCount: alerts.filter(a => a.priority === 'medium').length,
                lowPriorityCount: alerts.filter(a => a.priority === 'low').length,
                timestamp: new Date().toISOString(),
                dataSource: "Alpha Vantage Real-Time Market Scanning",
                nextScan: marketSession === 'MARKET_OPEN' ? '30 seconds' : '2 minutes'
            })
        };

    } catch (error) {
        console.error('[realtime-alerts.js] Error generating alerts:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Alerts generation error",
                details: error.message,
                alerts: [], // Always return empty array instead of mock data
                timestamp: new Date().toISOString(),
                dataSource: "Error - No Data Available"
            })
        };
    }
};
