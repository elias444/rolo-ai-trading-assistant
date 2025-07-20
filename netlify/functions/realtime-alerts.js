// netlify/functions/realtime-alerts.js
// REAL-TIME alerts based on up-to-the-second market data with futures/pre-market support
// ZERO MOCK DATA - Only displays real alerts or nothing

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
        console.log(`[realtime-alerts.js] Starting REAL-TIME alerts generation...`);
        
        const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
        
        if (!API_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Alpha Vantage API key not configured',
                    alerts: [], // Always empty array - NO mock data
                    timestamp: new Date().toISOString(),
                    dataSource: "Error - No API Key"
                })
            };
        }
        
        // Determine current market session for alert strategy
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const dayOfWeek = now.getDay();
        
        let marketSession = 'CLOSED';
        let alertStrategy = '';
        
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            marketSession = 'WEEKEND';
            alertStrategy = 'crypto_futures'; // Crypto and weekend futures
        } else if (currentTime >= 930 && currentTime < 1600) {
            marketSession = 'MARKET_OPEN';
            alertStrategy = 'realtime_breakouts'; // Real-time volume and price alerts
        } else if (currentTime >= 400 && currentTime < 930) {
            marketSession = 'PRE_MARKET';
            alertStrategy = 'premarket_movers'; // Pre-market earnings and news
        } else if (currentTime >= 1600 && currentTime < 2000) {
            marketSession = 'AFTER_HOURS';
            alertStrategy = 'afterhours_movers'; // After-hours earnings
        } else {
            marketSession = 'FUTURES_OPEN';
            alertStrategy = 'futures_alerts'; // International and futures
        }
        
        console.log(`[realtime-alerts.js] Market session: ${marketSession}, Alert strategy: ${alertStrategy}`);
        
        const validAlerts = [];
        
        // REAL-TIME MARKET HOURS ALERTS
        if (marketSession === 'MARKET_OPEN') {
            console.log(`[realtime-alerts.js] Scanning for REAL-TIME market alerts...`);
            
            // ALERT TYPE 1: Real Volume Spikes
            try {
                const topMoversUrl = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${API_KEY}`;
                const topMoversResponse = await fetch(topMoversUrl);
                const topMoversData = await topMoversResponse.json();
                
                if (topMoversData['most_actively_traded']) {
                    for (const stock of topMoversData['most_actively_traded'].slice(0, 5)) {
                        const volume = parseInt(stock.volume);
                        const changePercent = parseFloat(stock.change_percent.replace('%', ''));
                        const currentPrice = parseFloat(stock.price);
                        
                        // Real volume spike criteria (>5M volume + significant move)
                        if (volume >= 5000000 && Math.abs(changePercent) >= 3) {
                            const priority = volume >= 20000000 ? 'HIGH' : 'MEDIUM';
                            const alertType = changePercent > 0 ? 'VOLUME_BREAKOUT' : 'VOLUME_SELLOFF';
                            
                            validAlerts.push({
                                symbol: stock.ticker,
                                type: alertType,
                                priority: priority,
                                message: `${stock.ticker} volume spike: ${(volume/1000000).toFixed(1)}M shares traded (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%) at $${currentPrice}`,
                                action: `Monitor ${stock.ticker} for ${changePercent > 0 ? 'breakout continuation' : 'bounce opportunity'}. High volume confirms move.`,
                                realTimeData: {
                                    currentPrice: currentPrice,
                                    volume: volume,
                                    changePercent: changePercent,
                                    volumeRank: topMoversData['most_actively_traded'].indexOf(stock) + 1,
                                    marketSession: marketSession
                                },
                                timestamp: new Date().toISOString(),
                                dataSource: 'Alpha Vantage Real-Time'
                            });
                        }
                    }
                }
            } catch (error) {
                console.warn(`[realtime-alerts.js] Volume alerts error: ${error.message}`);
            }
            
            // ALERT TYPE 2: Real VIX Alerts
            try {
                const vixUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VIX&apikey=${API_KEY}`;
                const vixResponse = await fetch(vixUrl);
                const vixData = await vixResponse.json();
                
                if (vixData['Global Quote']) {
                    const vixPrice = parseFloat(vixData['Global Quote']['05. price']);
                    const vixChange = parseFloat(vixData['Global Quote']['10. change percent'].replace('%', ''));
                    
                    // Real VIX spike alert (>5% change or >25 level)
                    if (Math.abs(vixChange) >= 5 || vixPrice >= 25) {
                        const priority = vixPrice >= 30 || Math.abs(vixChange) >= 10 ? 'HIGH' : 'MEDIUM';
                        const sentiment = vixChange > 0 ? 'FEAR_SPIKE' : 'FEAR_DECLINE';
                        
                        validAlerts.push({
                            symbol: 'VIX',
                            type: sentiment,
                            priority: priority,
                            message: `VIX ${sentiment === 'FEAR_SPIKE' ? 'spiked' : 'declined'} ${vixChange > 0 ? '+' : ''}${vixChange.toFixed(1)}% to ${vixPrice.toFixed(2)}`,
                            action: `Market volatility ${sentiment === 'FEAR_SPIKE' ? 'increasing' : 'decreasing'}. ${sentiment === 'FEAR_SPIKE' ? 'Consider protective positions' : 'Risk-on environment developing'}.`,
                            realTimeData: {
                                vixLevel: vixPrice,
                                vixChange: vixChange,
                                fearGreedLevel: vixPrice >= 30 ? 'Extreme Fear' : vixPrice >= 20 ? 'Fear' : 'Greed',
                                marketSession: marketSession
                            },
                            timestamp: new Date().toISOString(),
                            dataSource: 'Alpha Vantage Real-Time'
                        });
                    }
                }
            } catch (error) {
                console.warn(`[realtime-alerts.js] VIX alerts error: ${error.message}`);
            }
            
            // ALERT TYPE 3: Real Price Breakouts
            try {
                if (topMoversData['top_gainers']) {
                    for (const stock of topMoversData['top_gainers'].slice(0, 3)) {
                        const changePercent = parseFloat(stock.change_percent.replace('%', ''));
                        const currentPrice = parseFloat(stock.price);
                        
                        // Real breakout criteria (>8% move)
                        if (changePercent >= 8) {
                            validAlerts.push({
                                symbol: stock.ticker,
                                type: 'PRICE_BREAKOUT',
                                priority: 'HIGH',
                                message: `${stock.ticker} breakout: +${changePercent.toFixed(1)}% to $${currentPrice.toFixed(2)}`,
                                action: `${stock.ticker} breaking out. Check for volume confirmation and resistance levels.`,
                                realTimeData: {
                                    currentPrice: currentPrice,
                                    changePercent: changePercent,
                                    breakoutLevel: currentPrice,
                                    marketSession: marketSession
                                },
                                timestamp: new Date().toISOString(),
                                dataSource: 'Alpha Vantage Real-Time'
                            });
                        }
                    }
                }
            } catch (error) {
                console.warn(`[realtime-alerts.js] Breakout alerts error: ${error.message}`);
            }
        }
        
        // PRE-MARKET ALERTS
        else if (marketSession === 'PRE_MARKET') {
            console.log(`[realtime-alerts.js] Scanning for PRE-MARKET alerts...`);
            
            const preMarketSymbols = ['SPY', 'QQQ', 'AAPL', 'TSLA', 'NVDA', 'MSFT'];
            
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
                        
                        // Get previous close for comparison
                        const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;
                        const quoteResponse = await fetch(quoteUrl);
                        const quoteData = await quoteResponse.json();
                        
                        if (quoteData['Global Quote']) {
                            const prevClose = parseFloat(quoteData['Global Quote']['08. previous close']);
                            const preMarketChange = ((currentPrice - prevClose) / prevClose) * 100;
                            
                            // Real pre-market alert criteria (>2% move)
                            if (Math.abs(preMarketChange) >= 2) {
                                const priority = Math.abs(preMarketChange) >= 4 ? 'HIGH' : 'MEDIUM';
                                const alertType = preMarketChange > 0 ? 'PRE_MARKET_GAP_UP' : 'PRE_MARKET_GAP_DOWN';
                                
                                validAlerts.push({
                                    symbol: symbol,
                                    type: alertType,
                                    priority: priority,
                                    message: `${symbol} pre-market ${preMarketChange > 0 ? 'gap up' : 'gap down'}: ${preMarketChange > 0 ? '+' : ''}${preMarketChange.toFixed(1)}% to $${currentPrice.toFixed(2)}`,
                                    action: `Monitor ${symbol} for ${preMarketChange > 0 ? 'gap fill or continuation' : 'bounce or further weakness'} at market open.`,
                                    realTimeData: {
                                        currentPrice: currentPrice,
                                        previousClose: prevClose,
                                        preMarketChange: preMarketChange,
                                        extendedHoursTime: latestTime,
                                        marketSession: marketSession
                                    },
                                    timestamp: new Date().toISOString(),
                                    dataSource: 'Alpha Vantage Extended Hours'
                                });
                            }
                        }
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 300));
                } catch (error) {
                    console.warn(`[realtime-alerts.js] Pre-market alert error for ${symbol}: ${error.message}`);
                }
            }
        }
        
        // FUTURES SESSION ALERTS
        else if (marketSession === 'FUTURES_OPEN') {
            console.log(`[realtime-alerts.js] Scanning for FUTURES alerts...`);
            
            const futuresProxies = ['SPY', 'QQQ', 'IWM'];
            
            for (const symbol of futuresProxies) {
                try {
                    const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;
                    const quoteResponse = await fetch(quoteUrl);
                    const quoteData = await quoteResponse.json();
                    
                    if (quoteData['Global Quote']) {
                        const quote = quoteData['Global Quote'];
                        const currentPrice = parseFloat(quote['05. price']);
                        const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));
                        
                        // Real futures-based alert criteria (>1.5% move)
                        if (Math.abs(changePercent) >= 1.5) {
                            const priority = Math.abs(changePercent) >= 3 ? 'HIGH' : 'MEDIUM';
                            const alertType = changePercent > 0 ? 'FUTURES_BULLISH' : 'FUTURES_BEARISH';
                            
                            validAlerts.push({
                                symbol: symbol,
                                type: alertType,
                                priority: priority,
                                message: `${symbol} futures signal: ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}% to ${currentPrice.toFixed(2)} during futures session`,
                                action: `${symbol} showing ${changePercent > 0 ? 'bullish' : 'bearish'} futures sentiment. Watch for continuation at market open.`,
                                realTimeData: {
                                    currentPrice: currentPrice,
                                    changePercent: changePercent,
                                    futuresSession: true,
                                    marketSession: marketSession
                                },
                                timestamp: new Date().toISOString(),
                                dataSource: 'Alpha Vantage Futures Proxy'
                            });
                        }
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 300));
                } catch (error) {
                    console.warn(`[realtime-alerts.js] Futures alert error for ${symbol}: ${error.message}`);
                }
            }
        }
        
        // WEEKEND ALERTS (Crypto and International Markets)
        else if (marketSession === 'WEEKEND') {
            console.log(`[realtime-alerts.js] Scanning for WEEKEND alerts...`);
            
            // Check major ETFs for any unusual Friday close activity that might affect Monday
            const weekendSymbols = ['SPY', 'QQQ', 'VIX'];
            
            for (const symbol of weekendSymbols) {
                try {
                    const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;
                    const quoteResponse = await fetch(quoteUrl);
                    const quoteData = await quoteResponse.json();
                    
                    if (quoteData['Global Quote']) {
                        const quote = quoteData['Global Quote'];
                        const fridayClose = parseFloat(quote['05. price']);
                        const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));
                        
                        // Weekend setup alerts for significant Friday moves
                        if (Math.abs(changePercent) >= 2) {
                            validAlerts.push({
                                symbol: symbol,
                                type: 'WEEKEND_SETUP',
                                priority: 'NORMAL',
                                message: `${symbol} Friday close: ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}% at ${fridayClose.toFixed(2)}`,
                                action: `Monitor ${symbol} for ${changePercent > 0 ? 'gap continuation' : 'gap fill opportunity'} at Monday open.`,
                                realTimeData: {
                                    fridayClose: fridayClose,
                                    weeklyChange: changePercent,
                                    marketSession: marketSession
                                },
                                timestamp: new Date().toISOString(),
                                dataSource: 'Alpha Vantage Weekend Analysis'
                            });
                        }
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 300));
                } catch (error) {
                    console.warn(`[realtime-alerts.js] Weekend alert error for ${symbol}: ${error.message}`);
                }
            }
        }
        
        // Sort alerts by priority and timestamp
        validAlerts.sort((a, b) => {
            const priorityOrder = { 'HIGH': 3, 'MEDIUM': 2, 'NORMAL': 1 };
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            }
            return new Date(b.timestamp) - new Date(a.timestamp);
        });
        
        const topAlerts = validAlerts.slice(0, 10); // Max 10 alerts
        
        console.log(`[realtime-alerts.js] Generated ${topAlerts.length} REAL alerts for ${marketSession}`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                alerts: topAlerts, // Only real alerts or empty array
                marketSession: marketSession,
                alertStrategy: alertStrategy,
                totalAlerts: validAlerts.length,
                priorityBreakdown: {
                    high: validAlerts.filter(a => a.priority === 'HIGH').length,
                    medium: validAlerts.filter(a => a.priority === 'MEDIUM').length,
                    normal: validAlerts.filter(a => a.priority === 'NORMAL').length
                },
                timestamp: new Date().toISOString(),
                dataSource: "Alpha Vantage Real-Time Market Data",
                nextScan: marketSession === 'MARKET_OPEN' ? '2 minutes' : '5 minutes',
                marketContext: {
                    session: marketSession,
                    alertTypes: [...new Set(validAlerts.map(a => a.type))],
                    dataQuality: 'Real-Time'
                }
            })
        };

    } catch (error) {
        console.error('[realtime-alerts.js] Error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Alerts generation error",
                details: error.message,
                alerts: [], // Always empty array, never mock data
                timestamp: new Date().toISOString(),
                dataSource: "Error - No Data Available"
            })
        };
    }
};
