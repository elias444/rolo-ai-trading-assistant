// netlify/functions/news-data.js
// Fetches news and sentiment data from Alpha Vantage

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

    const symbol = event.queryStringParameters?.symbol;
    const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

    if (!API_KEY) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'API key not configured' })
        };
    }

    try {
        const newsData = { symbol, articles: [], sentiment: {} };

        // Fetch News & Sentiment
        const newsUrl = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT${symbol ? `&tickers=${symbol}` : ''}&apikey=${API_KEY}`;
        console.log(`[news-data.js] Fetching news for ${symbol || 'market'}`);
        
        const newsResponse = await fetch(newsUrl);
        const newsJson = await newsResponse.json();

        if (newsJson.feed) {
            newsData.articles = newsJson.feed.slice(0, 10).map(article => ({
                title: article.title,
                summary: article.summary,
                source: article.source,
                url: article.url,
                time: article.time_published,
                sentiment: article.overall_sentiment_score,
                sentiment_label: article.overall_sentiment_label,
                ticker_sentiment: article.ticker_sentiment || []
            }));
        }

        // Calculate overall market sentiment
        if (newsJson.feed && newsJson.feed.length > 0) {
            const sentimentScores = newsJson.feed
                .map(a => parseFloat(a.overall_sentiment_score))
                .filter(s => !isNaN(s));
            
            const avgSentiment = sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length;
            
            newsData.sentiment = {
                score: avgSentiment.toFixed(3),
                label: avgSentiment > 0.15 ? 'Bullish' : 
                       avgSentiment < -0.15 ? 'Bearish' : 'Neutral',
                count: sentimentScores.length
            };
        }

        // Fetch Top Gainers & Losers
        const topMoversUrl = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${API_KEY}`;
        const moversResponse = await fetch(topMoversUrl);
        const moversData = await moversResponse.json();

        if (moversData.top_gainers) {
            newsData.topGainers = moversData.top_gainers.slice(0, 5);
        }
        if (moversData.top_losers) {
            newsData.topLosers = moversData.top_losers.slice(0, 5);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(newsData)
        };

    } catch (error) {
        console.error(`[news-data.js] Error:`, error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
