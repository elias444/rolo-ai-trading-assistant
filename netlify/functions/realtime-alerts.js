// netlify/functions/realtime-alerts.js
// REAL-TIME alerts based on up-to-the-second market data with futures/pre-market support

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
        console.log(`[realtime-alerts.js] Checking for REAL-TIME alerts with up-to-second data...`);
        const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

        if (!API_KEY) {
            console.error("[realtime-alerts.js] ALPHA_VANTAGE_API_KEY not configured.");
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Alpha Vantage API key is not configured.' })
            };
        }

        // Determine current market session
        const now = new Date();
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        const est = new Date(utcTime + (-5 * 3600000));
        const hours = est.getHours();
        const minutes = est.getMinutes();
        const day = est.getDay();
        
        let marketSession = 'Closed';
        let monitoringStrategy = 'regular';
        
        if (day === 0 || day === 6) {
            if (day === 0 && hours >= 18) {
                marketSession = 'Futures Open';
                monitoringStrategy = 'futures';
            } else {
                marketSession = 'Weekend';
                monitoringStrategy = 'futures';
            }
        } else {
            const totalMinutes = hours * 60 + minutes;
            if (totalMinutes >= 240 && totalMinutes < 570) {
                marketSession = 'Pre-Market';
                monitoringStrategy = 'premarket';
            } else if (totalMinutes >= 570 && totalMinutes < 960) {
                marketSession = 'Market Open';
                monitoringStrategy = 'regular';
            } else if (totalMinutes >= 960 && totalMinutes < 1200) {
                marketSession = 'After Hours';
                monitoringStrategy = 'premarket';
            } else {
                marketSession = 'Futures Open';
                monitoringStrategy = 'futures';
            }
        }

        console.log(`[realtime-alerts.js] Market Session: ${marketSession}, Monitoring: ${monitoringStrategy}`);

        const alerts = [];
        const realTimeData = {};

        // Step 1: Get REAL VIX data for volatility alerts
        let vixData = null;
        try {
            console.log("[realtime-alerts.js] Fetching real-time VIX data...");
            const vixResponse = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VIX&apikey=${API_KEY}`);
            
            if (vixResponse.ok) {
                const vixJson = await vixResponse.json();
                if (vixJson['Global Quote'] && vixJson['Global Quote']['05. price']) {
                    const vixPrice = parseFloat(vixJson['Global Quote']['05. price']);
                    const vixChange = parseFloat(vixJson['Global Quote']['09. change']);
                    const vixChangePercent = parseFloat(vixJson['Global Quote']['10. change percent'].replace('%', ''));
                    
                    vixData = { price: vixPrice, change: vixChange, changePercent: vixChangePercent };
                    
                    console.log(`[realtime-alerts.js] Real VIX: ${vixPrice}, Change: ${vixChange} (${vixChangePercent}%)`);
                    
                    // Generate volatility alerts based on REAL VIX data
                    if (vixPrice > 30) {
                        alerts.push({
                            type: 'market_volatility',
                            title: '🚨 EXTREME Volatility Alert',
                            description: `VIX spiked to ${vixPrice.toFixed(2)} (${vixChangePercent > 0 ? '+' : ''}${vixChangePercent.toFixed(2)}%) indicating extreme market fear and volatility.`,
                            priority: 'high',
                            timestamp: new Date().toISOString(),
                            action: 'Reduce position sizes immediately. Consider protective puts or volatility strategies.',
                            dataAge: 0,
                            marketSession
                        });
                    } else if (vixPrice > 25) {
                        alerts.push({
                            type: 'market_volatility',
                            title: '⚠️ High Volatility Alert',
                            description: `VIX at ${vixPrice.toFixed(2)} (${vixChangePercent > 0 ? '+' : ''}${vixChangePercent.toFixed(2)}%) suggests elevated market stress.`,
                            priority: 'high',
                            timestamp: new Date().toISOString(),
                            action: 'Monitor positions closely. Consider hedging strategies.',
                            dataAge: 0,
                            marketSession
                        });
                    } else if (vixPrice < 12) {
                        alerts.push({
                            type: 'market_calm',
                            title: '😴 Extreme Low Volatility',
                            description: `VIX at ${vixPrice.toFixed(2)} (${vixChangePercent > 0 ? '+' : ''}${vixChangePercent.toFixed(2)}%) indicates complacency. Volatility expansion likely.`,
                            priority: 'medium',
                            timestamp: new Date().toISOString(),
                            action: 'Consider volatility strategies. Watch for breakout setups.',
                            dataAge: 0,
                            marketSession
                        });
                    }
                    
                    // VIX spike alert (change > 15% in any direction)
                    if (Math.abs(vixChangePercent) > 15) {
                        alerts.push({
                            type: 'volatility_spike',
                            title: `${vixChangePercent > 0 ? '📈' : '📉'} VIX Spike Alert`,
                            description: `VIX ${vixChangePercent > 0 ? 'surged' : 'collapsed'} ${Math.abs(vixChangePercent).toFixed(2)}% to ${vixPrice.toFixed(2)}. Major sentiment shift.`,
                            priority: 'high',
                            timestamp: new Date().toISOString(),
                            action: `${vixChangePercent > 0 ? 'Defensive positioning recommended' : 'Risk-on opportunity emerging'}`,
                            dataAge: 0,
                            marketSession
                        });
                    }
                }
            }
        } catch (e) {
            console.warn("[realtime-alerts.js] Could not fetch real VIX data:", e.message);
        }

        // Step 2: Monitor based on market session
        if (monitoringStrategy === 'regular') {
            // Regular market hours - monitor active stocks with real-time data
            console.log("[realtime-alerts.js] Fetching real-time market movers...");
            
            try {
                const moversResponse = await fetch(`https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${API_KEY}`);
                
                if (moversResponse.ok) {
                    const moversData = await moversResponse.json();
                    
                    if (moversData['Error Message'] || moversData['Note']) {
                        console.warn("[realtime-alerts.js] Movers API limit:", moversData['Error Message'] || moversData['Note']);
                    } else if (moversData.top_gainers && moversData.top_losers) {
                        
                        // Real-time breakout alerts from top gainers
                        moversData.top_gainers.slice(0, 5).forEach(stock => {
                            const changePercent = parseFloat(stock.change_percentage.replace('%', ''));
                            const volume = parseInt(stock.volume);
                            const price = parseFloat(stock.price);
                            
                            if (changePercent > 15 && volume > 500000) {
                                alerts.push({
                                    type: 'breakout_alert',
                                    title: `🚀 ${stock.ticker} BREAKOUT`,
                                    description: `${stock.ticker} exploding +${changePercent.toFixed(2)}% to $${price.toFixed(2)} on ${volume.toLocaleString()} volume!`,
                                    priority: 'high',
                                    timestamp: new Date().toISOString(),
                                    action: `Check ${stock.ticker} for news catalyst. Monitor for continuation or reversal.`,
                                    dataAge: 0,
                                    marketSession
                                });
                            } else if (changePercent > 8 && volume > 200000) {
                                alerts.push({
                                    type: 'strong_move',
                                    title: `📈 ${stock.ticker} Strong Move`,
                                    description: `${stock.ticker} up +${changePercent.toFixed(2)}% with solid volume.`,
                                    priority: 'medium',
                                    timestamp: new Date().toISOString(),
                                    action: `Monitor ${stock.ticker} momentum and volume.`,
                                    dataAge: 0,
                                    marketSession
                                });
                            }
                        });

                        // Real-time crash alerts from top losers
                        moversData.top_losers.slice(0, 5).forEach(stock => {
                            const changePercent = parseFloat(stock.change_percentage.replace('%', ''));
                            const volume = parseInt(stock.volume);
                            const price = parseFloat(stock.price);
                            
                            if (changePercent < -15 && volume > 500000) {
                                alerts.push({
                                    type: 'crash_alert',
                                    title: `💥 ${stock.ticker} CRASH`,
                                    description: `${stock.ticker} crashing ${changePercent.toFixed(2)}% to $${price.toFixed(2)} on ${volume.toLocaleString()} volume!`,
                                    priority: 'high',
                                    timestamp: new Date().toISOString(),
                                    action: `Check ${stock.ticker} for negative news. Potential bounce candidate if oversold.`,
                                    dataAge: 0,
                                    marketSession
                                });
                            } else if (changePercent < -8 && volume > 200000) {
                                alerts.push({
                                    type: 'sharp_decline',
                                    title: `📉 ${stock.ticker} Sharp Decline`,
                                    description: `${stock.ticker} down ${changePercent.toFixed(2)}% with elevated volume.`,
                                    priority: 'medium',
                                    timestamp: new Date().toISOString(),
                                    action: `Monitor ${stock.ticker} for potential reversal signals.`,
                                    dataAge: 0,
                                    marketSession
                                });
                            }
                        });
                    }
                }
            } catch (e) {
                console.warn("[realtime-alerts.js] Could not fetch market movers:", e.message);
            }

            // Real-time monitoring of key watchlist stocks with 1-minute data
            const watchlist = ['SPY', 'QQQ', 'AAPL', 'TSLA', 'NVDA'];
            
            for (const symbol of watchlist) {
                try {
                    console.log(`[realtime-alerts.js] Fetching 1-minute data for ${symbol}...`);
                    
                    const intradayUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=1min&entitlement=realtime&outputsize=compact&apikey=${API_KEY}`;
                    const response = await fetch(intradayUrl);
                    
                    if (response.ok) {
                        const data = await response.json();
                        
                        if (data['Time Series (1min)']) {
                            const timeSeries = data['Time Series (1min)'];
                            const timestamps = Object.keys(timeSeries).sort();
                            
                            if (timestamps.length >= 5) {
                                const latest = timeSeries[timestamps[timestamps.length - 1]];
                                const fiveMinAgo = timeSeries[timestamps[timestamps.length - 5]];
                                
                                const currentPrice = parseFloat(latest['4. close']);
                                const fiveMinPrice = parseFloat(fiveMinAgo['4. close']);
                                const momentum = ((currentPrice - fiveMinPrice) / fiveMinPrice) * 100;
                                const volume = parseInt(latest['5. volume']);
                                
                                const dataAge = Math.floor((new Date() - new Date(timestamps[timestamps.length - 1])) / 1000);
                                
                                // Real-time momentum alerts (5-minute momentum > 1%)
                                if (Math.abs(momentum) > 1 && dataAge < 300) {
                                    alerts.push({
                                        type: 'momentum_alert',
                                        title: `${momentum > 0 ? '⚡' : '⚡'} ${symbol} Real-Time Momentum`,
                                        description: `${symbol} moving ${momentum > 0 ? '+' : ''}${momentum.toFixed(2)}% in last 5 minutes to ${currentPrice.toFixed(2)}`,
                                        priority: Math.abs(momentum) > 2 ? 'high' : 'medium',
                                        timestamp: new Date().toISOString(),
                                        action: `Watch ${symbol} for continuation. Data is ${dataAge} seconds old.`,
                                        dataAge: dataAge,
                                        marketSession
                                    });
                                }
                                
                                // Volume spike detection (current minute vs 5-minute average)
                                const avgVolume = timestamps.slice(-5).reduce((sum, ts) => sum + parseInt(timeSeries[ts]['5. volume']), 0) / 5;
                                const volumeSpike = volume / avgVolume;
                                
                                if (volumeSpike > 3 && dataAge < 300) {
                                    alerts.push({
                                        type: 'volume_spike',
                                        title: `📊 ${symbol} Volume Spike`,
                                        description: `${symbol} showing ${volumeSpike.toFixed(1)}x volume spike: ${volume.toLocaleString()} vs ${Math.floor(avgVolume).toLocaleString()} avg`,
                                        priority: 'medium',
                                        timestamp: new Date().toISOString(),
                                        action: `Monitor ${symbol} for unusual activity. Data is ${dataAge} seconds old.`,
                                        dataAge: dataAge,
                                        marketSession
                                    });
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn(`[realtime-alerts.js] Could not fetch 1min data for ${symbol}:`, e.message);
                }
            }

        } else if (monitoringStrategy === 'premarket' || monitoringStrategy === 'futures') {
            // Extended hours monitoring
            console.log(`[realtime-alerts.js] Monitoring ${monitoringStrategy} session...`);
            
            const extendedSymbols = monitoringStrategy === 'futures' ? 
                ['ES=F', 'NQ=F', 'YM=F', 'GC=F', 'CL=F'] : // Futures
                ['SPY', 'QQQ', 'IWM', 'AAPL', 'TSLA', 'NVDA']; // Pre-market ETFs and major stocks
            
            for (const symbol of extendedSymbols) {
                try {
                    console.log(`[realtime-alerts.js] Fetching ${monitoringStrategy} data for ${symbol}...`);
                    
                    const response = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&entitlement=realtime&apikey=${API_KEY}`);
                    
                    if (response.ok) {
                        const data = await response.json();
                        
                        if (data['Global Quote'] && data['Global Quote']['05. price']) {
                            const quote = data['Global Quote'];
                            const price = parseFloat(quote['05. price']);
                            const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));
                            const change = parseFloat(quote['09. change']);
                            
                            const sessionLabel = monitoringStrategy === 'futures' ? 'Futures' : 'Extended Hours';
                            
                            // Extended hours movement alerts (lower thresholds)
                            if (Math.abs(changePercent) > 0.75) {
                                alerts.push({
                                    type: 'extended_hours_move',
                                    title: `${changePercent > 0 ? '🌙' : '🌅'} ${symbol} ${sessionLabel} Move`,
                                    description: `${symbol} ${changePercent > 0 ? 'up' : 'down'} ${Math.abs(changePercent).toFixed(2)}% in ${sessionLabel.toLowerCase()} to ${price.toFixed(2)}`,
                                    priority: Math.abs(changePercent) > 2 ? 'high' : 'medium',
                                    timestamp: new Date().toISOString(),
                                    action: `Monitor ${symbol} for market open gap. Current ${sessionLabel.toLowerCase()} move: ${change > 0 ? '+' : ''}${change.toFixed(2)}`,
                                    dataAge: 0,
                                    marketSession
                                });
                            }
                            
                            // Futures-specific alerts for major levels
                            if (monitoringStrategy === 'futures' && symbol.includes('=F')) {
                                // Major level breaks (simplified - in production, use actual support/resistance)
                                const majorLevelThreshold = symbol === 'ES=F' ? 50 : symbol === 'NQ=F' ? 200 : 1000; // Points
                                
                                if (Math.abs(change) > majorLevelThreshold * 0.1) { // 10% of major threshold
                                    alerts.push({
                                        type: 'futures_level_break',
                                        title: `🌜 ${symbol} Major Move`,
                                        description: `${symbol} breaking ${change > 0 ? 'higher' : 'lower'} by ${Math.abs(change).toFixed(1)} points overnight`,
                                        priority: 'high',
                                        timestamp: new Date().toISOString(),
                                        action: `Prepare for gap ${change > 0 ? 'up' : 'down'} at market open. Consider ${change > 0 ? 'bullish' : 'bearish'} positioning.`,
                                        dataAge: 0,
                                        marketSession
                                    });
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn(`[realtime-alerts.js] Could not fetch ${monitoringStrategy} data for ${symbol}:`, e.message);
                }
            }
        }

        // Step 3: Check currency and crypto for 24/7 markets
        if (monitoringStrategy === 'futures') {
            const cryptoSymbols = ['BTC', 'ETH'];
            
            for (const symbol of cryptoSymbols) {
                try {
                    const response = await fetch(`https://www.alphavantage.co/query?function=DIGITAL_CURRENCY_DAILY&symbol=${symbol}&market=USD&apikey=${API_KEY}`);
                    
                    if (response.ok) {
                        const data = await response.json();
                        
                        if (data['Time Series (Digital Currency Daily)']) {
                            const latestDate = Object.keys(data['Time Series (Digital Currency Daily)'])[0];
                            const latestData = data['Time Series (Digital Currency Daily)'][latestDate];
                            const price = parseFloat(latestData['4a. close (USD)']);
                            const open = parseFloat(latestData['1a. open (USD)']);
                            const changePercent = ((price - open) / open) * 100;
                            
                            if (Math.abs(changePercent) > 3) {
                                alerts.push({
                                    type: 'crypto_move',
                                    title: `₿ ${symbol} Crypto Alert`,
                                    description: `${symbol} ${changePercent > 0 ? 'up' : 'down'} ${Math.abs(changePercent).toFixed(2)}% to ${price.toLocaleString()}`,
                                    priority: Math.abs(changePercent) > 8 ? 'high' : 'medium',
                                    timestamp: new Date().toISOString(),
                                    action: `Monitor ${symbol} for correlation with risk assets. 24/7 market signal.`,
                                    dataAge: 0,
                                    marketSession: 'Crypto (24/7)'
                                });
                            }
                        }
                    }
                } catch (e) {
                    console.warn(`[realtime-alerts.js] Could not fetch crypto data for ${symbol}:`, e.message);
                }
            }
        }

        // Sort alerts by priority and data freshness
        alerts.sort((a, b) => {
            const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            }
            return (a.dataAge || 0) - (b.dataAge || 0); // Fresher data first
        });

        if (alerts.length === 0) {
            console.log("[realtime-alerts.js] No significant real-time alerts detected");
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    alerts: [],
                    timestamp: new Date().toISOString(),
                    message: `No significant ${marketSession.toLowerCase()} alerts detected`,
                    marketSession,
                    monitoringStrategy,
                    vixLevel: vixData?.price || null
                })
            };
        }

        console.log(`[realtime-alerts.js] Generated ${alerts.length} real-time alerts for ${marketSession}`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                alerts: alerts.slice(0, 15), // Limit to top 15 alerts
                timestamp: new Date().toISOString(),
                marketSession,
                monitoringStrategy,
                dataSource: "Alpha Vantage Real-Time",
                vixLevel: vixData?.price || null,
                totalAlertsGenerated: alerts.length,
                averageDataAge: alerts.reduce((sum, alert) => sum + (alert.dataAge || 0), 0) / alerts.length
            })
        };

    } catch (error) {
        console.error(`[realtime-alerts.js] Server error:`, error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Server error while checking real-time alerts",
                timestamp: new Date().toISOString()
            })
        };
    }
};
