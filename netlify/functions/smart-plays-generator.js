// netlify/functions/smart-plays-generator.js
// This function generates smart trading plays based on REAL market data from Alpha Vantage.

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
        console.log(`[smart-plays-generator.js] Generating smart trading plays from REAL market data...`);
        const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

        if (!API_KEY) {
            console.error("[smart-plays-generator.js] ALPHA_VANTAGE_API_KEY environment variable is not set.");
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Alpha Vantage API key is not configured.' })
            };
        }

        const plays = [];

        // --- Get REAL Market Sentiment from SPY/QQQ ---
        let marketSentiment = 'neutral';
        let sp500Data = null;
        let nasdaqData = null;

        try {
            // Fetch SPY (S&P 500 ETF)
            const spyResponse = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=SPY&entitlement=realtime&apikey=${API_KEY}`);
            const spyData = await spyResponse.json();
            if (spyResponse.ok && spyData['Global Quote'] && spyData['Global Quote']['05. price']) {
                sp500Data = {
                    symbol: 'SPY',
                    price: parseFloat(spyData['Global Quote']['05. price']),
                    change: parseFloat(spyData['Global Quote']['09. change']),
                    changePercent: parseFloat(spyData['Global Quote']['10. change percent'].replace('%', ''))
                };
            }

            // Fetch QQQ (NASDAQ ETF)
            const qqqqResponse = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=QQQ&entitlement=realtime&apikey=${API_KEY}`);
            const qqqData = await qqqqResponse.json();
            if (qqqqResponse.ok && qqqData['Global Quote'] && qqqData['Global Quote']['05. price']) {
                nasdaqData = {
                    symbol: 'QQQ',
                    price: parseFloat(qqqData['Global Quote']['05. price']),
                    change: parseFloat(qqqData['Global Quote']['09. change']),
                    changePercent: parseFloat(qqqData['Global Quote']['10. change percent'].replace('%', ''))
                };
            }

            // Determine market sentiment from REAL data
            if (sp500Data && nasdaqData) {
                if (sp500Data.changePercent > 0.5 && nasdaqData.changePercent > 0.5) {
                    marketSentiment = 'bullish';
                } else if (sp500Data.changePercent < -0.5 && nasdaqData.changePercent < -0.5) {
                    marketSentiment = 'bearish';
                }
            }
        } catch (e) {
            console.warn("[smart-plays-generator.js] Could not fetch index data:", e.message);
        }

        // --- Get REAL Top Gainers and Losers ---
        let topGainers = [];
        let topLosers = [];
        
        try {
            const moversResponse = await fetch(`https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${API_KEY}`);
            const moversData = await moversResponse.json();
            
            if (moversResponse.ok && moversData.top_gainers && moversData.top_losers) {
                topGainers = moversData.top_gainers.slice(0, 5).map(stock => ({
                    symbol: stock.ticker,
                    price: parseFloat(stock.price),
                    changePercent: parseFloat(stock.change_percentage.replace('%', '')),
                    volume: parseInt(stock.volume)
                }));
                
                topLosers = moversData.top_losers.slice(0, 5).map(stock => ({
                    symbol: stock.ticker,
                    price: parseFloat(stock.price),
                    changePercent: parseFloat(stock.change_percentage.replace('%', '')),
                    volume: parseInt(stock.volume)
                }));
            }
        } catch (e) {
            console.warn("[smart-plays-generator.js] Could not fetch top movers:", e.message);
        }

        // --- Generate Plays Based on REAL Market Data ONLY ---
        
        // Only generate plays if we have real data
        if (sp500Data && nasdaqData) {
            if (marketSentiment === 'bullish') {
                plays.push({
                    emoji: '🚀',
                    title: 'Market Momentum Long',
                    ticker: 'SPY',
                    strategy: 'ETF Long',
                    confidence: 75,
                    entry: (sp500Data.price * 0.998).toFixed(2), // Slightly below current price
                    stopLoss: (sp500Data.price * 0.985).toFixed(2), // 1.5% stop loss
                    targets: [
                        (sp500Data.price * 1.01).toFixed(2),
                        (sp500Data.price * 1.025).toFixed(2)
                    ],
                    timeframe: 'Short-term',
                    riskLevel: 'medium',
                    reasoning: `SPY showing bullish momentum (+${sp500Data.changePercent.toFixed(2)}%). Market indices trending positive.`,
                    newsImpact: 'Broad market strength supporting upward movement'
                });

                if (nasdaqData.changePercent > sp500Data.changePercent) {
                    plays.push({
                        emoji: '💻',
                        title: 'Tech Sector Strength',
                        ticker: 'QQQ',
                        strategy: 'Tech ETF Long',
                        confidence: 80,
                        entry: (nasdaqData.price * 0.997).toFixed(2),
                        stopLoss: (nasdaqData.price * 0.98).toFixed(2),
                        targets: [
                            (nasdaqData.price * 1.015).toFixed(2),
                            (nasdaqData.price * 1.03).toFixed(2)
                        ],
                        timeframe: 'Short-term',
                        riskLevel: 'medium',
                        reasoning: `QQQ outperforming SPY (+${nasdaqData.changePercent.toFixed(2)}% vs +${sp500Data.changePercent.toFixed(2)}%). Tech leading the market.`,
                        newsImpact: 'Technology sector showing relative strength'
                    });
                }
            } else if (marketSentiment === 'bearish') {
                plays.push({
                    emoji: '📉',
                    title: 'Market Downtrend Protection',
                    ticker: 'SQQQ',
                    strategy: 'Inverse ETF',
                    confidence: 70,
                    entry: null, // Would need real SQQQ price
                    stopLoss: null,
                    targets: [null],
                    timeframe: 'Short-term',
                    riskLevel: 'high',
                    reasoning: `Market showing bearish signals. SPY ${sp500Data.changePercent.toFixed(2)}%, QQQ ${nasdaqData.changePercent.toFixed(2)}%.`,
                    newsImpact: 'Broad market weakness suggesting defensive positioning'
                });
            }
        }

        // Generate plays from top gainers (only if we have real data)
        if (topGainers.length > 0) {
            const topGainer = topGainers[0];
            if (topGainer.changePercent > 5 && topGainer.volume > 1000000) {
                plays.push({
                    emoji: '🔥',
                    title: 'Momentum Breakout',
                    ticker: topGainer.symbol,
                    strategy: 'Momentum',
                    confidence: 65,
                    entry: (topGainer.price * 1.001).toFixed(2), // Enter on continuation
                    stopLoss: (topGainer.price * 0.95).toFixed(2), // 5% stop
                    targets: [
                        (topGainer.price * 1.1).toFixed(2),
                        (topGainer.price * 1.15).toFixed(2)
                    ],
                    timeframe: 'Intraday',
                    riskLevel: 'high',
                    reasoning: `${topGainer.symbol} showing strong momentum (+${topGainer.changePercent.toFixed(2)}%) with high volume (${topGainer.volume.toLocaleString()}).`,
                    newsImpact: 'Check for specific news catalysts driving the move'
                });
            }
        }

        // Generate plays from top losers for potential bounce (only if we have real data)
        if (topLosers.length > 0) {
            const topLoser = topLosers[0];
            if (topLoser.changePercent < -8 && topLoser.volume > 1000000) {
                plays.push({
                    emoji: '🔄',
                    title: 'Oversold Bounce',
                    ticker: topLoser.symbol,
                    strategy: 'Mean Reversion',
                    confidence: 55,
                    entry: (topLoser.price * 1.02).toFixed(2), // Enter on bounce
                    stopLoss: (topLoser.price * 0.95).toFixed(2), // 5% stop
                    targets: [
                        (topLoser.price * 1.08).toFixed(2),
                        (topLoser.price * 1.12).toFixed(2)
                    ],
                    timeframe: 'Short-term',
                    riskLevel: 'high',
                    reasoning: `${topLoser.symbol} severely oversold (${topLoser.changePercent.toFixed(2)}%) with high volume. Potential for bounce if no fundamental issues.`,
                    newsImpact: 'Verify no major negative news before entering'
                });
            }
        }

        // If no real data available, return empty array (NO MOCK DATA)
        if (plays.length === 0) {
            console.log(`[smart-plays-generator.js] No real market data available for generating plays.`);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    plays: [],
                    marketSentiment: 'unknown',
                    timestamp: new Date().toISOString(),
                    message: 'No trading opportunities identified with current market data',
                    dataAvailable: {
                        sp500: !!sp500Data,
                        nasdaq: !!nasdaqData,
                        topGainers: topGainers.length,
                        topLosers: topLosers.length
                    }
                })
            };
        }

        console.log(`[smart-plays-generator.js] Generated ${plays.length} real data-based smart plays.`);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                plays: plays,
                marketSentiment: marketSentiment,
                timestamp: new Date().toISOString(),
                dataSource: 'Alpha Vantage Real-Time',
                marketData: {
                    sp500: sp500Data,
                    nasdaq: nasdaqData,
                    topGainersCount: topGainers.length,
                    topLosersCount: topLosers.length
                }
            })
        };

    } catch (error) {
        console.error(`[smart-plays-generator.js] Unexpected server error:`, error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: `Server error while generating smart plays: ${error.message}`,
                details: 'Check server logs for more information'
            })
        };
    }
};
