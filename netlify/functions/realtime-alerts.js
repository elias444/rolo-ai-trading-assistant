// netlify/functions/realtime-alerts.js
// This function generates real-time alerts based on market data from Alpha Vantage.

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
        console.log(`[realtime-alerts.js] Checking for real-time alerts...`);
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
        const watchlist = ['SPY', 'QQQ', 'AAPL', 'TSLA', 'NVDA', 'MSFT']; // Example watchlist

        // --- Fetch VIX (Volatility Index) ---
        // Alpha Vantage does not have a direct VIX API for real-time quote.
        // We will simulate or use a proxy if available. For now, we'll use a placeholder.
        let vixLevel = null;
        try {
            // Attempt to get SPY data as a proxy for market sentiment
            const spyResponse = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=SPY&entitlement=realtime&apikey=${API_KEY}`);
            const spyData = await spyResponse.json();
            if (spyResponse.ok && spyData['Global Quote'] && spyData['Global Quote']['05. price']) {
                const spyChangePercent = parseFloat(spyData['Global Quote']['10. change percent']);
                // Simple VIX simulation based on SPY movement
                if (spyChangePercent < -1.5) vixLevel = 28; // Significant drop -> high fear
                else if (spyChangePercent > 1.5) vixLevel = 12; // Significant rise -> low fear
                else vixLevel = 18; // Neutral
            }
        } catch (e) {
            console.warn("[realtime-alerts.js] Could not get SPY data for VIX proxy:", e.message);
        }

        if (vixLevel) {
            if (vixLevel > 25) {
                alerts.push({
                    type: 'market_volatility',
                    title: '🚨 High Volatility Alert',
                    description: `Market volatility (simulated VIX: ${vixLevel.toFixed(2)}) is high. Expect choppy price action.`,
                    priority: 'high',
                    timestamp: new Date().toISOString(),
                    action: 'Consider smaller position sizes or defensive strategies.'
                });
            } else if (vixLevel < 15) {
                alerts.push({
                    type: 'market_calm',
                    title: '🧘 Market Calm Alert',
                    description: `Market volatility (simulated VIX: ${vixLevel.toFixed(2)}) is low. Could precede a breakout.`,
                    priority: 'low',
                    timestamp: new Date().toISOString(),
                    action: 'Monitor for unusual volume spikes or news events.'
                });
            }
        }

        // --- Fetch Watchlist Stock Data for Alerts ---
        for (const symbol of watchlist) {
            try {
                const stockResponse = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&entitlement=realtime&apikey=${API_KEY}`);
                const stockData = await stockResponse.json();

                if (stockResponse.ok && stockData['Global Quote'] && stockData['Global Quote']['10. change percent']) {
                    const changePercent = parseFloat(stockData['Global Quote']['10. change percent']);
                    const price = parseFloat(stockData['Global Quote']['05. price']);
                    const volume = parseInt(stockData['Global Quote']['06. volume']);

                    // Alert for significant price movement (e.g., > 3%)
                    if (Math.abs(changePercent) > 3) {
                        const direction = changePercent > 0 ? 'up' : 'down';
                        alerts.push({
                            type: 'price_movement',
                            title: `📈 ${symbol} Price Alert`,
                            description: `${symbol} is moving significantly (${changePercent}% ${direction}). Current price: $${price.toFixed(2)}.`,
                            priority: 'high',
                            timestamp: new Date().toISOString(),
                            action: `Investigate news and technical levels for ${symbol}.`
                        });
                    }

                    // Alert for high volume spike (simple threshold)
                    const averageVolume = 20000000; // Example average volume
                    if (volume > averageVolume * 2) { // Volume is more than double average
                        alerts.push({
                            type: 'volume_spike',
                            title: `📊 ${symbol} Volume Spike`,
                            description: `${symbol} showing unusually high volume (${volume.toLocaleString()}).`,
                            priority: 'medium',
                            timestamp: new Date().toISOString(),
                            action: `Analyze ${symbol}'s price action and market context.`
                        });
                    }

                } else if (stockData['Note']) {
                    console.warn(`[realtime-alerts.js] Alpha Vantage Note for ${symbol}: ${stockData['Note']}`);
                }
            } catch (e) {
                console.error(`[realtime-alerts.js] Error fetching data for ${symbol}:`, e.message);
            }
        }

        // Add a default alert if no specific alerts are generated
        if (alerts.length === 0) {
            alerts.push({
                type: 'info',
                title: 'Market Quiet',
                description: 'No significant real-time alerts detected at the moment. Market conditions are calm.',
                priority: 'low',
                timestamp: new Date().toISOString(),
                action: 'Continue monitoring or explore other features.'
            });
        }

        console.log(`[realtime-alerts.js] Generated ${alerts.length} alerts.`);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                alerts: alerts,
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error(`[realtime-alerts.js] Unexpected server error:`, error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: `An unexpected server error occurred: ${error.message}. Please check Netlify function logs.`,
                details: error.message
            })
        };
    }
};
