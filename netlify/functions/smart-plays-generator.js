// netlify/functions/smart-plays-generator.js
// This function generates smart trading plays based on market data from Alpha Vantage.

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
        console.log(`[smart-plays-generator.js] Generating smart trading plays...`);
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

        // --- Get Market Sentiment from SPY/QQQ ---
        let marketSentiment = 'neutral';
        let sp500Change = 0;
        let nasdaqChange = 0;

        try {
            const spxResponse = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=SPY&entitlement=realtime&apikey=${API_KEY}`);
            const spxData = await spxResponse.json();
            if (spxResponse.ok && spxData['Global Quote'] && spxData['Global Quote']['10. change percent']) {
                sp500Change = parseFloat(spxData['Global Quote']['10. change percent']);
            }

            const nasdaqResponse = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=QQQ&entitlement=realtime&apikey=${API_KEY}`);
            const nasdaqData = await nasdaqResponse.json();
            if (nasdaqResponse.ok && nasdaqData['Global Quote'] && nasdaqData['Global Quote']['10. change percent']) {
                nasdaqChange = parseFloat(nasdaqData['Global Quote']['10. change percent']);
            }

            if (sp500Change > 1.0 && nasdaqChange > 1.0) {
                marketSentiment = 'bullish';
            } else if (sp500Change < -1.0 && nasdaqChange < -1.0) {
                marketSentiment = 'bearish';
            }
        } catch (e) {
            console.warn("[smart-plays-generator.js] Could not fetch index data for sentiment:", e.message);
        }

        // --- Generate Plays Based on Market Sentiment ---
        if (marketSentiment === 'bullish') {
            plays.push({
                emoji: '🚀',
                title: 'Market Momentum Long',
                ticker: 'SPY / QQQ Calls',
                strategy: 'Trend Following',
                confidence: 85,
                description: `Overall market (S&P 500 and NASDAQ) showing strong bullish momentum. Consider long positions on major indices or leading growth stocks.`,
                timeframe: 'Intraday / Short-term',
                risk_level: 'Medium'
            });
            plays.push({
                emoji: '💡',
                title: 'Tech Sector Strength',
                ticker: 'NVDA / MSFT',
                strategy: 'Growth Stock Long',
                confidence: 80,
                description: `Tech sector leading the market rally. Look for strong tech stocks for continuation.`,
                timeframe: 'Short-term',
                risk_level: 'Medium'
            });
        } else if (marketSentiment === 'bearish') {
            plays.push({
                emoji: '📉',
                title: 'Market Downtrend Short',
                ticker: 'SPY / QQQ Puts',
                strategy: 'Inverse ETF / Bearish Options',
                confidence: 80,
                description: `Overall market showing strong bearish momentum. Consider hedging or short positions on major indices.`,
                timeframe: 'Intraday / Short-term',
                risk_level: 'Medium'
            });
            plays.push({
                emoji: '🛡️',
                title: 'Defensive Sector Rotation',
                ticker: 'Utilities / Consumer Staples',
                strategy: 'Defensive Long',
                confidence: 70,
                description: `In a bearish market, defensive sectors may offer relative strength.`,
                timeframe: 'Medium-term',
                risk_level: 'Low'
            });
        } else {
            plays.push({
                emoji: '⚖️',
                title: 'Consolidation Play',
                ticker: 'Range-bound stocks',
                strategy: 'Iron Condor / Straddle',
                confidence: 60,
                description: `Market is consolidating. Look for stocks trading in a defined range for options strategies that profit from low volatility.`,
                timeframe: 'Short-term',
                risk_level: 'Medium'
            });
            plays.push({
                emoji: '🔎',
                title: 'Event-Driven Opportunity',
                ticker: 'Upcoming Earnings',
                strategy: 'Volatility Play',
                confidence: 65,
                description: `Focus on individual stocks with upcoming catalysts like earnings reports for potential volatility plays.`,
                timeframe: 'Short-term',
                risk_level: 'High'
            });
        }

        // Add a generic play if nothing specific was generated
        if (plays.length === 0) {
            plays.push({
                emoji: '🤔',
                title: 'Market Observation',
                ticker: 'N/A',
                strategy: 'Observe & Learn',
                confidence: 50,
                description: 'Market is currently calm or lacking clear directional signals. Focus on research and learning.',
                timeframe: 'N/A',
                risk_level: 'Low'
            });
        }

        console.log(`[smart-plays-generator.js] Generated ${plays.length} smart plays.`);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                plays: plays,
                marketSentiment: marketSentiment,
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error(`[smart-plays-generator.js] Unexpected server error:`, error);
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
