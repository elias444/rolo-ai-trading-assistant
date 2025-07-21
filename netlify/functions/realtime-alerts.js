// netlify/functions/realtime-alerts.js
// FINAL WORKING VERSION - Generates real market alerts

exports.handler = async (event, context) => {
    console.log('Alerts function started');
    
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
                    alerts: [],
                    error: 'API key not configured',
                    timestamp: new Date().toISOString()
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

        console.log(`Market session: ${marketSession}`);

        const alerts = [];

        // Alert Type 1: VIX Movement Alerts
        try {
            console.log('Checking VIX for volatility alerts...');
            const vixUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VIX&apikey=${API_KEY}`;
            const vixResponse = await fetch(vixUrl);
            
            if (vixResponse.ok) {
                const vixData = await vixResponse.json();
                
                if (vixData['Global Quote']) {
                    const vixQuote = vixData['Global Quote'];
                    const vixLevel = parseFloat(vixQuote['05. price']);
                    const vixChange = parseFloat(vixQuote['10. change percent'].replace('%', ''));
                    
                    // VIX alerts based on level and change
                    if (vixLevel > 25 || Math.abs(vixChange) > 8) {
                        const priority = vixLevel > 35 || Math.abs(vixChange) > 15 ? 'HIGH' : 'MEDIUM';
                        const alertType = vixChange > 0 ? 'VIX_SPIKE' : 'VIX_DECLINE';
                        
                        alerts.push({
                            symbol: 'VIX',
                            type: alertType,
                            priority: priority,
                            message: `Market volatility ${vixChange > 0 ? 'spiking' : 'declining'}: VIX ${vixChange > 0 ? 'up' : 'down'} ${Math.abs(vixChange).toFixed(1)}% to ${vixLevel.toFixed(1)}`,
                            action: vixChange > 0 ? 
                                   'Consider defensive positioning and risk management' : 
                                   'Risk-on environment developing, monitor for opportunities',
                            timestamp: new Date().toISOString()
                        });
                        
                        console.log(`✅ VIX Alert: ${vixLevel} (${vixChange > 0 ? '+' : ''}${vixChange.toFixed(1)}%)`);
                    }
                    
                    // Additional VIX level alerts
                    if (vixLevel > 30) {
                        alerts.push({
                            symbol: 'VIX',
                            type: 'HIGH_VOLATILITY',
                            priority: 'HIGH',
                            message: `Extreme market fear detected: VIX at ${vixLevel.toFixed(1)} (Fear Zone)`,
                            action: 'High volatility environment - consider protective strategies',
                            timestamp: new Date().toISOString()
                        });
                    } else if (vixLevel < 15) {
                        alerts.push({
                            symbol: 'VIX',
                            type: 'LOW_VOLATILITY',
                            priority: 'NORMAL',
                            message: `Market complacency detected: VIX at ${vixLevel.toFixed(1)} (Low Volatility)`,
                            action: 'Calm markets - potential for volatility expansion',
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            }
        } catch (vixError) {
            console.error('VIX alert error:', vixError.message);
        }

        // Alert Type 2: Market Movers Alerts
        try {
            console.log('Checking for significant market moves...');
            const topMoversUrl = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${API_KEY}`;
            const topMoversResponse = await fetch(topMoversUrl);
            
            if (topMoversResponse.ok) {
                const topMoversData = await topMoversResponse.json();
                
                // High volume alerts
                if (topMoversData['most_actively_traded']) {
                    for (const stock of topMoversData['most_actively_traded'].slice(0, 3)) {
                        const volume = parseInt(stock.volume);
                        const changePercent = parseFloat(stock.change_percent.replace('%', ''));
                        const price = parseFloat(stock.price);
                        
                        // Unusual volume + significant move
                        if (volume > 20000000 && Math.abs(changePercent) > 5) {
                            const priority = volume > 50000000 ? 'HIGH' : 'MEDIUM';
                            
                            alerts.push({
                                symbol: stock.ticker,
                                type: 'VOLUME_SPIKE',
                                priority: priority,
                                message: `${stock.ticker} unusual activity: ${(volume/1000000).toFixed(0)}M volume with ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}% move`,
                                action: `Investigate ${stock.ticker} for news catalysts and momentum continuation`,
                                timestamp: new Date().toISOString()
                            });
                            
                            console.log(`✅ Volume Alert: ${stock.ticker} - ${(volume/1000000).toFixed(0)}M vol`);
                        }
                    }
                }
                
                // Extreme price movement alerts
                if (topMoversData['top_gainers']) {
                    for (const stock of topMoversData['top_gainers'].slice(0, 2)) {
                        const changePercent = parseFloat(stock.change_percent.replace('%', ''));
                        const price = parseFloat(stock.price);
                        
                        if (changePercent > 15 && price > 2) {
                            alerts.push({
                                symbol: stock.ticker,
                                type: 'BREAKOUT',
                                priority: 'HIGH',
                                message: `${stock.ticker} major breakout: +${changePercent.toFixed(1)}% surge to $${price.toFixed(2)}`,
                                action: `Monitor ${stock.ticker} for continuation above resistance levels`,
                                timestamp: new Date().toISOString()
                            });
                            
                            console.log(`✅ Breakout Alert: ${stock.ticker} +${changePercent.toFixed(1)}%`);
                        }
                    }
                }
                
                if (topMoversData['top_losers']) {
                    for (const stock of topMoversData['top_losers'].slice(0, 2)) {
                        const changePercent = parseFloat(stock.change_percent.replace('%', ''));
                        const price = parseFloat(stock.price);
                        
                        if (changePercent < -15 && price > 3) {
                            alerts.push({
                                symbol: stock.ticker,
                                type: 'SELLOFF',
                                priority: 'HIGH',
                                message: `${stock.ticker} major selloff: ${changePercent.toFixed(1)}% decline to $${price.toFixed(2)}`,
                                action: `Check ${stock.ticker} for news and potential oversold bounce levels`,
                                timestamp: new Date().toISOString()
                            });
                            
                            console.log(`✅ Selloff Alert: ${stock.ticker} ${changePercent.toFixed(1)}%`);
                        }
                    }
                }
            }
        } catch (topMoversError) {
            console.error('Top movers alert error:', topMoversError.message);
        }

        // Alert Type 3: Index Movement Alerts
        try {
            console.log('Checking major indices for alerts...');
            const indices = [
                { symbol: 'SPY', name: 'S&P 500' },
                { symbol: 'QQQ', name: 'NASDAQ' },
                { symbol: 'DIA', name: 'Dow Jones' }
            ];
            
            for (const index of indices) {
                const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${index.symbol}&apikey=${API_KEY}`;
                const quoteResponse = await fetch(quoteUrl);
                
                if (quoteResponse.ok) {
                    const quoteData = await quoteResponse.json();
                    
                    if (quoteData['Global Quote']) {
                        const quote = quoteData['Global Quote'];
                        const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));
                        const price = parseFloat(quote['05. price']);
                        
                        // Significant index moves
                        if (Math.abs(changePercent) > 2) {
                            const priority = Math.abs(changePercent) > 3 ? 'HIGH' : 'MEDIUM';
                            const direction = changePercent > 0 ? 'rally' : 'decline';
                            
                            alerts.push({
                                symbol: index.symbol,
                                type: `INDEX_${direction.toUpperCase()}`,
                                priority: priority,
                                message: `${index.name} ${direction}: ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}% to ${price.toFixed(2)}`,
                                action: `Broad market ${direction} - monitor sector rotation and individual stock impacts`,
                                timestamp: new Date().toISOString()
                            });
                            
                            console.log(`✅ Index Alert: ${index.name} ${changePercent.toFixed(1)}%`);
                        }
                    }
                }
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } catch (indexError) {
            console.error('Index alerts error:', indexError.message);
        }

        // Alert Type 4: Session-Specific Alerts
        const currentHour = now.getHours();
        
        if (marketSession === 'PRE_MARKET' && currentHour === 8) {
            alerts.push({
                symbol: 'MARKET',
                type: 'SESSION_ALERT',
                priority: 'NORMAL',
                message: 'Pre-market session active - Market opens in 1.5 hours',
                action: 'Monitor pre-market movers and prepare for market open gaps',
                timestamp: new Date().toISOString()
            });
        } else if (marketSession === 'MARKET_OPEN' && (currentHour === 9 || currentHour === 15)) {
            const timeAlert = currentHour === 9 ? 'Market opening' : 'Market closing approach';
            alerts.push({
                symbol: 'MARKET',
                type: 'SESSION_ALERT',
                priority: 'NORMAL',
                message: `${timeAlert} - Increased volatility expected`,
                action: `${currentHour === 9 ? 'Gap trading opportunities' : 'End-of-day position management'}`,
                timestamp: new Date().toISOString()
            });
        } else if (marketSession === 'WEEKEND') {
            alerts.push({
                symbol: 'MARKET',
                type: 'SESSION_ALERT',
                priority: 'NORMAL',
                message: 'Weekend session - Crypto and international markets active',
                action: 'Review weekly performance and plan for Monday market open',
                timestamp: new Date().toISOString()
            });
        }

        // Sort alerts by priority
        alerts.sort((a, b) => {
            const priorityOrder = { 'HIGH': 3, 'MEDIUM': 2, 'NORMAL': 1 };
            const aPriority = priorityOrder[a.priority] || 0;
            const bPriority = priorityOrder[b.priority] || 0;
            return bPriority - aPriority;
        });

        // Limit to top 8 alerts
        const topAlerts = alerts.slice(0, 8);

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
                generatedAt: new Date().toISOString(),
                dataSource: "Alpha Vantage Real-Time Market Data",
                nextScan: marketSession === 'MARKET_OPEN' ? '5 minutes' : '15 minutes'
            })
        };

    } catch (error) {
        console.error('Alerts generation error:', error);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                alerts: [],
                error: "Alerts temporarily unavailable",
                details: error.message,
                marketSession: 'Unknown',
                timestamp: new Date().toISOString()
            })
        };
    }
};
