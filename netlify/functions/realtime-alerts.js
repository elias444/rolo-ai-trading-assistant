// netlify/functions/realtime-alerts.js
// This function generates real-time alerts based on REAL market data from Alpha Vantage.

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
        console.log(`[realtime-alerts.js] Checking for real-time alerts from REAL market data...`);
        const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

        if (!API_KEY) {
            console.error("[realtime-alerts.js] ALPHA_VANTAGE_API_KEY environment variable is not set.");
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Alpha Vantage API key is not configured.' })
            };
        }

        const alerts = [];
        const watchlist = ['SPY', 'QQQ', 'AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL', 'META', 'AMZN'];

        // --- Get REAL VIX data (volatility) ---
        let vixLevel = null;
        try {
            const vixResponse = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VIX&apikey=${API_KEY}`);
            const vixData = await vixResponse.json();
            if (vixResponse.ok && vixData['Global Quote'] && vixData['Global Quote']['05. price']) {
                vixLevel = parseFloat(vixData['Global Quote']['05. price']);
                const vixChange = parseFloat(vixData['Global Quote']['09. change']);
                
                if (vixLevel > 25) {
                    alerts.push({
                        type: 'market_volatility',
                        title: '🚨 High Volatility Alert',
                        description: `VIX at ${vixLevel.toFixed(2)} indicates high market fear. Current change: ${vixChange > 0 ? '+' : ''}${vixChange.toFixed(2)}`,
                        priority: 'high',
                        timestamp: new Date().toISOString(),
                        action: 'Consider reducing position sizes and implementing protective strategies.'
                    });
                } else if (vixLevel < 15) {
                    alerts.push({
                        type: 'market_calm',
                        title: '🧘 Low Volatility Environment',
                        description: `VIX at ${vixLevel.toFixed(2)} suggests market complacency. Change: ${vixChange > 0 ? '+' : ''}${vixChange.toFixed(2)}`,
                        priority: 'low',
                        timestamp: new Date().toISOString(),
                        action: 'Monitor for potential volatility breakouts. Consider volatility strategies.'
                    });
                }
            }
        } catch (e) {
            console.warn("[realtime-alerts.js] Could not fetch VIX data:", e.message);
        }

        // --- Get REAL Top Gainers/Losers for volume and price alerts ---
        try {
            const moversResponse = await fetch(`https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${API_KEY}`);
            const moversData = await moversResponse.json();
            
            if (moversResponse.ok && moversData.top_gainers && moversData.top_losers) {
                // Check top gainers for significant moves
                moversData.top_gainers.slice(0, 3).forEach(stock => {
                    const changePercent = parseFloat(stock.change_percentage.replace('%', ''));
                    const volume = parseInt(stock.volume);
                    const price = parseFloat(stock.price);
                    
                    if (changePercent > 10 && volume > 1000000) {
                        alerts.push({
                            type: 'price_movement',
                            title: `📈 ${stock.ticker} Major Breakout`,
                            description: `${stock.ticker} surging +${changePercent.toFixed(2)}% to $${price.toFixed(2)} with ${volume.toLocaleString()} shares traded.`,
                            priority: 'high',
                            timestamp: new Date().toISOString(),
                            action: `Investigate ${stock.ticker} for news catalysts and technical breakout levels.`
                        });
                    } else if (changePercent > 5 && volume > 500000) {
                        alerts.push({
                            type: 'price_movement',
                            title: `📊 ${stock.ticker} Strong Move`,
                            description: `${stock.ticker} up +${changePercent.toFixed(2)}% with elevated volume.`,
                            priority: 'medium',
                            timestamp: new Date().toISOString(),
                            action: `Monitor ${stock.ticker} for continuation or reversal signals.`
                        });
                    }
                });

                // Check top losers for significant drops
                moversData.top_losers.slice(0, 3).forEach(stock => {
                    const changePercent = parseFloat(stock.change_percentage.replace('%', ''));
                    const volume = parseInt(stock.volume);
                    const price = parseFloat(stock.price);
                    
                    if (changePercent < -10 && volume > 1000000) {
                        alerts.push({
                            type: 'price_movement',
                            title: `📉 ${stock.ticker} Major Decline`,
                            description: `${stock.ticker} falling ${changePercent.toFixed(2)}% to $${price.toFixed(2)} with ${volume.toLocaleString()} shares traded.`,
                            priority: 'high',
                            timestamp: new Date().toISOString(),
                            action: `Check ${stock.ticker} for negative news or earnings issues. Potential oversold bounce candidate.`
                        });
                    }
                });
            }
        } catch (e) {
            console.warn("[realtime-alerts.js] Could not fetch top movers data:", e.message);
        }

        // --- Check specific watchlist stocks for REAL data alerts ---
        const promises = watchlist.map(async (symbol) => {
            try {
                const stockResponse = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&entitlement=realtime&apikey=${API_KEY}`);
                const stockData = await stockResponse.json();

                if (stockResponse.ok && stockData['Global Quote'] && stockData['Global Quote']['10. change percent']) {
                    const changePercent = parseFloat(stockData['Global Quote']['10. change percent'].replace('%', ''));
                    const price = parseFloat(stockData['Global Quote']['05. price']);
                    const volume = parseInt(stockData['Global Quote']['06. volume']);

                    // Alert for significant price movement (watchlist specific)
                    if (Math.abs(changePercent) > 3) {
                        const direction = changePercent > 0 ? 'up' : 'down';
                        alerts.push({
                            type: 'price_movement',
                            title: `${changePercent > 0 ? '📈' : '📉'} ${symbol} Watchlist Alert`,
                            description: `${symbol} moving significantly ${direction} ${Math.abs(changePercent).toFixed(2)}% to $${price.toFixed(2)}.`,
                            priority: Math.abs(changePercent) > 5 ? 'high' : 'medium',
                            timestamp: new Date().toISOString(),
                            action: `Review ${symbol} chart and recent news for continuation signals.`
                        });
                    }

                    // Volume spike detection (compare to typical volume)
                    const typicalVolume = {
                        'SPY': 50000000,
                        'QQQ': 40000000,
                        'AAPL': 45000000,
                        'TSLA': 70000000,
                        'NVDA': 45000000,
                        'MSFT': 25000000,
                        'GOOGL': 25000000,
                        'META': 20000000,
                        'AMZN': 30000000
                    };

                    if (typicalVolume[symbol] && volume > typicalVolume[symbol] * 2) {
                        alerts.push({
                            type: 'volume_spike',
                            title: `📊 ${symbol} Volume Spike`,
                            description: `${symbol} showing unusually high volume: ${volume.toLocaleString()} vs typical ${typicalVolume[symbol].toLocaleString()}.`,
                            priority: 'medium',
                            timestamp: new Date().toISOString(),
                            action: `Analyze ${symbol} for institutional activity or pending news.`
                        });
                    }
                }
            } catch (e) {
                console.warn(`[realtime-alerts.js] Error fetching data for ${symbol}:`, e.message);
            }
        });

        // Wait for all watchlist checks to complete
        await Promise.all(promises);

        // --- Check for unusual market conditions using sector ETFs ---
        try {
            const sectorETFs = ['XLF', 'XLK', 'XLE', 'XLV']; // Financial, Tech, Energy, Healthcare
            const sectorPromises = sectorETFs.map(async (etf) => {
                try {
                    const response = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${etf}&apikey=${API_KEY}`);
                    const data = await response.json();
                    if (response.ok && data['Global Quote']) {
                        const changePercent = parseFloat(data['Global Quote']['10. change percent'].replace('%', ''));
                        return { etf, changePercent };
                    }
                } catch (e) {
                    console.warn(`[realtime-alerts.js] Error fetching ${etf}:`, e.message);
                }
                return null;
            });

            const sectorResults = (await Promise.all(sectorPromises)).filter(result => result !== null);
            
            if (sectorResults.length > 0) {
                const extremeSectors = sectorResults.filter(sector => Math.abs(sector.changePercent) > 2);
                if (extremeSectors.length > 0) {
                    const sector = extremeSectors[0];
                    alerts.push({
                        type: 'sector_rotation',
                        title: `🔄 Sector Movement Alert`,
                        description: `${sector.etf} showing significant movement: ${sector.changePercent > 0 ? '+' : ''}${sector.changePercent.toFixed(2)}%.`,
                        priority: 'medium',
                        timestamp: new Date().toISOString(),
                        action: `Monitor sector rotation patterns and related stocks.`
                    });
                }
            }
        } catch (e) {
            console.warn("[realtime-alerts.js] Error checking sector ETFs:", e.message);
        }

        // If no alerts generated from real data, return empty array (NO DEFAULT/MOCK ALERTS)
        if (alerts.length === 0) {
            console.log(`[realtime-alerts.js] No significant market alerts detected from real data.`);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    alerts: [],
                    timestamp: new Date().toISOString(),
                    message: 'No significant market alerts at this time',
                    dataChecked: {
                        vixAvailable: vixLevel !== null,
                        watchlistStocks: watchlist.length,
                        marketMoversChecked: true
                    }
                })
            };
        }

        // Sort alerts by priority and timestamp
        alerts.sort((a, b) => {
            const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            }
            return new Date(b.timestamp) - new Date(a.timestamp);
        });

        console.log(`[realtime-alerts.js] Generated ${alerts.length} real market alerts.`);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                alerts: alerts.slice(0, 10), // Limit to top 10 alerts
                timestamp: new Date().toISOString(),
                dataSource: 'Alpha Vantage Real-Time',
                totalAlertsGenerated: alerts.length
            })
        };

    } catch (error) {
        console.error(`[realtime-alerts.js] Unexpected server error:`, error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: `Server error while checking alerts: ${error.message}`,
                details: 'Check server logs for more information'
            })
        };
    }
};
