const fetch = require('node-fetch');
const { GoogleGenerativeAI } = require('@google/generative-ai');

exports.handler = async (event) => {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const { symbol = 'AAPL', type = 'analysis', messages, favorites = [] } = JSON.parse(event.body || '{}');

  try {
    const quoteRes = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`);
    const quoteData = await quoteRes.json();
    const quote = quoteData['Global Quote'] || {};
    const price = quote['05. price'] || 'N/A';
    const change = quote['09. change'] || '0';
    const volume = quote['06. volume'] || 'N/A';

    const now = new Date();
    const estHour = (now.getUTCHours() - 5 + 24) % 24;
    const estMinute = now.getUTCMinutes();
    const day = now.getDay();
    
    let marketSession = 'Market Closed';
    if (day === 0 || day === 6) {
      marketSession = 'Weekend';
    } else {
      if (estHour >= 4 && (estHour < 9 || (estHour === 9 && estMinute < 30))) marketSession = 'Pre-Market';
      if (estHour >= 9 && estHour < 16) marketSession = 'Market Open';
      if (estHour >= 16 && estHour < 20) marketSession = 'After Hours';
    }

    const newsRes = await fetch(`https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${symbol}&apikey=${apiKey}`);
    const newsData = await newsRes.json();
    const news = newsData.feed ? newsData.feed.slice(0, 5).map(item => `${item.title} (Sentiment: ${item.overall_sentiment_label})`) : ['No news'];
    const sentiment = newsData.sentiment_score_definition || 'Neutral';

    const rsiRes = await fetch(`https://www.alphavantage.co/query?function=RSI&symbol=${symbol}&interval=daily&time_period=14&series_type=close&apikey=${apiKey}`);
    const rsiData = await rsiRes.json();
    const rsi = rsiData['Technical Analysis: RSI'] ? Object.values(rsiData['Technical Analysis: RSI'])[0].RSI : 'N/A';

    const macdRes = await fetch(`https://www.alphavantage.co/query?function=MACD&symbol=${symbol}&interval=daily&series_type=close&apikey=${apiKey}`);
    const macdData = await macdRes.json();
    const macd = macdData['Technical Analysis: MACD'] ? Object.values(macdData['Technical Analysis: MACD'])[0]['MACD'] : 'N/A';

    const econRes = await fetch(`https://www.alphavantage.co/query?function=FEDERAL_FUNDS_RATE&interval=daily&apikey=${apiKey}`);
    const econData = await econRes.json();
    const fedRate = econData.data ? econData.data[0].value : 'N/A';

    const futuresRes = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=ES&apikey=${apiKey}`);
    const futuresData = await futuresRes.json();
    const futuresPrice = futuresData['Time Series (Daily)'] ? Object.values(futuresData['Time Series (Daily)'])[0]['4. close'] : 'N/A';

    let socialSentiment = 'Neutral';
    try {
      const socialRes = await fetch(`https://api.stocktwits.com/api/2/streams/symbol/${symbol}.json`);
      const socialData = await socialRes.json();
      socialSentiment = socialData.sentiment ? socialData.sentiment.bullish ? 'Bullish' : 'Bearish' : 'Neutral';
    } catch {}

    const dataSummary = `
      Symbol: ${symbol}
      Session: ${marketSession}
      Current Price: $${price} (Change: ${change}%)
      Volume: ${volume}
      Technicals: RSI=${rsi}, MACD=${macd}
      News: ${news.join('; ')}
      Sentiment: ${sentiment} (Social: ${socialSentiment})
      Economics: Fed Rate=${fedRate}%
      Futures: S&P Futures at $${futuresPrice}
    `;

    let prompt = '';
    if (type === 'analysis') {
      prompt = `Provide in-depth stock analysis for ${symbol} using this real data: ${dataSummary}. Include 3 support and 3 resistance levels, multiple entry points with reasoning, short-term and long-term price targets, risk/reward ratios, trading strategy recommendations, and risk assessment. Incorporate news impact, technical indicators, and market conditions. Provide trading recommendations with confidence levels (50-100%). Be actionable and detailed. Learn from user favorites: ${favorites.join(', ')}. Use emojis like 📈 for engaging.`;
    } else if (type === 'smartplays') {
      prompt = `Generate hourly smart trading plays for ${symbol} during market hours using this real data: ${dataSummary}. Each play should include entry price, stop loss, target price, confidence level (50-100%), and reasoning based on real-time data and news. Include both stock and options plays.`;
    } else if (type === 'chat') {
      prompt = messages.map(m => m.content).join('\n') + '\nRespond naturally as a trading AI using this data: ${dataSummary}. Learn from favorites: ${favorites.join(', ')}.`;
    }

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();

    let plays = [];
    if (type === 'smartplays') {
      plays = aiResponse.split('\n').filter(line => line.trim()).map((line, i) => ({ id: i, play: line, confidence: Math.floor(50 + Math.random() * 51) }));
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        response: aiResponse,
        analysis: type === 'analysis' ? aiResponse : null,
        plays,
        session: marketSession,
      })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: 'AI error' }) };
  }
};
