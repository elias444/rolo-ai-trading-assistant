// netlify/functions/realtime-alerts.js
// WORKING VERSION - Generates real market alerts

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
                    alerts: []
                })
            };
        }

        console.log('Generating real-time alerts...');

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

        const alerts = [];

        // Alert Type 1: VIX Alerts
        try {
            const vixUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VIX&apikey=${API_KEY}`;
            const vixResponse = await fetch(vixUrl);
            
            if (vixResponse.ok) {
                const vixJson = await vixResponse.json();
                
                if (vixJson['Global Quote']) {
                    const vixQuote = vixJson['Global Quote'];
                    const vixLevel = parseFloat(vixQuote['05. price']);
                    const vixChange = parseFloat(vixQuote['10. change percent'].replace('%', ''));
                    
                    // VIX spike alert
                    if (vixLevel > 20 || Math.abs(vixChange) > 5) {
                        const priority = vixLevel > 30 || Math.abs(vixChange) > 10 ? 'HIGH' : 'MEDIUM';
                        const alertType = vixChange > 0 ? 'VIX_SPIKE' : 'VIX_DECLINE';
                        
                        alerts.push({
                            symbol: 'VIX',
                            type: alertType,
                            priority: priority,
                            message: `VIX ${vixChange > 0 ? 'spiked' : 'declined'} ${vixChange > 0 ? '+' : ''}${vixChange.toFixed(1)}% to ${vixLevel.toFixed(2)}`,
                            action: vixChange > 0 ? 'Consider defensive positions' : 'Risk-on environment developing',
                            timestamp: new Date().toISOString()
                        });
                        
                        console.log(`✅ VIX Alert: Level ${vixLevel}, Change ${vixChange}%`);
                    }
                }
            }
        } catch (vixError) {
            console.error('VIX alert error:', vixError.message);
        }

        // Alert Type 2: Top Movers Alerts
        try {
            const topMoversUrl = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${API_KEY}`;
            const topMoversResponse = await fetch(topMoversUrl);
            
            if (topMoversResponse.ok) {
                const topMoversData = await topMoversResponse.json();
                
                // Volume spike alerts from most active
                if (topMoversData['most_actively_traded']) {
                    for (const stock of topMoversData['most_actively_traded'].slice(0, 3)) {
                        const volume = parseInt(stock.volume);
                        const changePercent = parseFloat(stock.change_percent.replace('%', ''));
                        const currentPrice = parseFloat(stock.price);
                        
                        // High volume + significant move = alert
                        if (volume > 5000000 && Math.abs(changePercent) > 3) {
                            const priority = volume > 20000000 ? 'HIGH' : 'MEDIUM';
                            const alertType = changePercent > 0 ? 'VOLUME_BREAKOUT' : 'VOLUME_SELLOFF';
                            
                            alerts.push({
                                symbol: stock.ticker,
                                type: alertType,
                                priority: priority,
                                message: `${stock.ticker} volume spike: ${(volume/1000000).toFixed(1)}M shares (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%)`,
                                action: `Monitor ${stock.ticker} for ${changePercent > 0 ? 'continuation' : 'bounce'}`,
                                timestamp: new Date().toISOString()
                            });
                            
                            console.log(`✅ Volume Alert: ${stock.ticker} - ${(volume/1000000).toFixed(1)}M volume`);
                        }
                    }
                }
                
                // Price breakout alerts from top gainers
                if (topMoversData['top_gainers']) {
                    for (const stock of topMoversData['top_gainers'].slice(0, 2)) {
                        const changePercent = parseFloat(stock.change_percent.replace('%', ''));
                        const currentPrice = parseFloat(stock.price);
                        
                        // Major breakout alert
                        if (changePercent > 8 && currentPrice > 1) {
                            alerts.push({
                                symbol: stock.ticker,
                                type: 'PRICE_BREAKOUT',
                                priority: 'HIGH',
                                message: `${stock.ticker} breakout: +${changePercent.toFixed(1)}% to $${currentPrice.toFixed(2)}`,
                                action: `Check ${stock.ticker} for volume confirmation and resistance levels`,
                                timestamp: new Date().toISOString()
                            });
                            
                            console.log(`✅ Breakout Alert: ${stock.ticker} +${changePercent.toFixed(1)}%`);
                        }
                    }
                }
                
                // Crash alerts from top losers
                if (topMoversData['top_losers']) {
                    for (const stock of topMoversData['top_losers'].slice(0, 2)) {
                        const changePercent = parseFloat(stock.change_percent.replace('%', ''));
                        const currentPrice = parseFloat(stock.price);
                        
                        // Major selloff alert
                        if (changePercent < -10 && currentPrice > 2) {
                            alerts.push({
                                symbol: stock.ticker,
                                type: 'PRICE_CRASH',
                                priority: 'HIGH',
                                message: `${stock.ticker} selloff: ${changePercent.toFixed(1)}% to $${currentPrice.toFixed(2)}`,
                                action: `Check ${stock.ticker} for news and potential bounce levels`,
                                timestamp: new Date().toISOString()
                            });
                            
                            console.log(`✅ Crash Alert: ${stock.ticker} ${changePercent.toFixed(1)}%`);
                        }
                    }
                }
            }
        } catch (topMoversError) {
            console.error('Top movers alert error:', topMoversError.message);
        }

        // Alert Type 3: Index Movement Alerts
        const majorIndices = ['SPY', 'QQQ', 'DIA'];
        
        for (const symbol of majorIndices) {
            try {
                const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;
                const quoteResponse = await fetch(quoteUrl);
                
                if (quoteResponse.ok) {
                    const quoteJson = await quoteResponse.json();
                    
                    if (quoteJson['Global Quote']) {
                        const quote = quoteJson['Global Quote'];
                        const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));
                        const currentPrice = parseFloat(quote['05. price']);
                        
                        // Major index move alert
                        if (Math.abs(changePercent) > 1.5) {
                            const priority = Math.abs(changePercent) > 2.5 ? 'HIGH' : 'MEDIUM';
                            const alertType = changePercent > 0 ? 'INDEX_RALLY' : 'INDEX_DECLINE';
                            const indexName = symbol === 'SPY' ? 'S&P 500' : 
                                            symbol === 'QQQ' ? 'NASDAQ' : 'Dow Jones';
                            
                            alerts.push({
                                symbol: symbol,
                                type: alertType,
                                priority: priority,
                                message: `${indexName} ${changePercent > 0 ? 'rally' : 'decline'}: ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%`,
                                action: `Monitor ${indexName} for ${changePercent > 0 ? 'continuation or resistance' : 'support or further weakness'}`,
                                timestamp: new Date().toISOString()
                            });
                            
                            console.log(`✅ Index Alert: ${indexName} ${changePercent.toFixed(1)}%`);
                        }
                    }
                }
                
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (indexError) {
                console.error(`Index ${symbol} alert error:`, indexError.message);
            }
        }

        // Alert Type 4: Session-specific alerts
        if (marketSession === 'PRE_MARKET' || marketSession === 'AFTER_HOURS') {
            alerts.push({
                symbol: 'MARKET',
                type: 'SESSION_INFO',
                priority: 'NORMAL',
                message: `${marketSession.replace('_', '-')} session active - Extended hours trading in progress`,
                action: 'Monitor for earnings reactions and gap setups for market open',
                timestamp: new Date().toISOString()
            });
        } else if (marketSession === 'WEEKEND') {
            alerts.push({
                symbol: 'MARKET',
                type: 'SESSION_INFO',
                priority: 'NORMAL',
                message: 'Weekend session - Markets closed, crypto and futures active',
                action: 'Review weekly performance and prepare for Monday open',
                timestamp: new Date().toISOString()
            });
        }

        // Sort alerts by priority
        alerts.sort((a, b) => {
            const priorityOrder = { 'HIGH': 3, 'MEDIUM': 2, 'NORMAL': 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });

        const topAlerts = alerts.slice(0, 8); // Max 8 alerts

        console.log(`✅ Generated ${topAlerts.length} real-time alerts`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                alerts: topAlerts,
                marketSession: marketSession,
                totalAlerts: alerts.length,
                priorityBreakdown: {
                    high: alerts.filter(a => a.priority === 'HIGH').length,
                    medium: alerts.filter(a => a.priority === 'MEDIUM').length,
                    normal: alerts.filter(a => a.priority === 'NORMAL').length
                },
                timestamp: new Date().toISOString(),
                dataSource: "Alpha Vantage Real-Time Market Data"
            })
        };

    } catch (error) {
        console.error('Realtime alerts error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Alerts generation failed",
                details: error.message,
                alerts: [],
                timestamp: new Date().toISOString()
            })
        };
    }
};
