// netlify/functions/technical-indicators.js
// Fetches technical indicators from Alpha Vantage

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
    if (!symbol) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Symbol parameter is required' })
        };
    }

    const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
    if (!API_KEY) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'API key not configured' })
        };
    }

    try {
        console.log(`[technical-indicators.js] Fetching technicals for ${symbol}`);
        
        const technicals = {
            symbol,
            timestamp: new Date().toISOString(),
            indicators: {}
        };

        // Fetch RSI
        const rsiUrl = `https://www.alphavantage.co/query?function=RSI&symbol=${symbol}&interval=daily&time_period=14&series_type=close&apikey=${API_KEY}`;
        const rsiResponse = await fetch(rsiUrl);
        const rsiData = await rsiResponse.json();
        
        if (rsiData['Technical Analysis: RSI']) {
            const latestDate = Object.keys(rsiData['Technical Analysis: RSI'])[0];
            technicals.indicators.rsi = {
                value: parseFloat(rsiData['Technical Analysis: RSI'][latestDate]['RSI']),
                date: latestDate,
                signal: parseFloat(rsiData['Technical Analysis: RSI'][latestDate]['RSI']) > 70 ? 'Overbought' :
                        parseFloat(rsiData['Technical Analysis: RSI'][latestDate]['RSI']) < 30 ? 'Oversold' : 'Neutral'
            };
        }

        // Fetch MACD
        const macdUrl = `https://www.alphavantage.co/query?function=MACD&symbol=${symbol}&interval=daily&series_type=close&apikey=${API_KEY}`;
        const macdResponse = await fetch(macdUrl);
        const macdData = await macdResponse.json();
        
        if (macdData['Technical Analysis: MACD']) {
            const latestDate = Object.keys(macdData['Technical Analysis: MACD'])[0];
            const macd = parseFloat(macdData['Technical Analysis: MACD'][latestDate]['MACD']);
            const signal = parseFloat(macdData['Technical Analysis: MACD'][latestDate]['MACD_Signal']);
            technicals.indicators.macd = {
                macd: macd,
                signal: signal,
                histogram: parseFloat(macdData['Technical Analysis: MACD'][latestDate]['MACD_Hist']),
                date: latestDate,
                bullish: macd > signal
            };
        }

        // Fetch Bollinger Bands
        const bbUrl = `https://www.alphavantage.co/query?function=BBANDS&symbol=${symbol}&interval=daily&time_period=20&series_type=close&apikey=${API_KEY}`;
        const bbResponse = await fetch(bbUrl);
        const bbData = await bbResponse.json();
        
        if (bbData['Technical Analysis: BBANDS']) {
            const latestDate = Object.keys(bbData['Technical Analysis: BBANDS'])[0];
            technicals.indicators.bollingerBands = {
                upper: parseFloat(bbData['Technical Analysis: BBANDS'][latestDate]['Real Upper Band']),
                middle: parseFloat(bbData['Technical Analysis: BBANDS'][latestDate]['Real Middle Band']),
                lower: parseFloat(bbData['Technical Analysis: BBANDS'][latestDate]['Real Lower Band']),
                date: latestDate
            };
        }

        // Fetch SMA (50 and 200 day)
        const sma50Url = `https://www.alphavantage.co/query?function=SMA&symbol=${symbol}&interval=daily&time_period=50&series_type=close&apikey=${API_KEY}`;
        const sma50Response = await fetch(sma50Url);
        const sma50Data = await sma50Response.json();
        
        if (sma50Data['Technical Analysis: SMA']) {
            const latestDate = Object.keys(sma50Data['Technical Analysis: SMA'])[0];
            technicals.indicators.sma50 = {
                value: parseFloat(sma50Data['Technical Analysis: SMA'][latestDate]['SMA']),
                date: latestDate
            };
        }

        const sma200Url = `https://www.alphavantage.co/query?function=SMA&symbol=${symbol}&interval=daily&time_period=200&series_type=close&apikey=${API_KEY}`;
        const sma200Response = await fetch(sma200Url);
        const sma200Data = await sma200Response.json();
        
        if (sma200Data['Technical Analysis: SMA']) {
            const latestDate = Object.keys(sma200Data['Technical Analysis: SMA'])[0];
            technicals.indicators.sma200 = {
                value: parseFloat(sma200Data['Technical Analysis: SMA'][latestDate]['SMA']),
                date: latestDate
            };
        }

        // Fetch ADX (Average Directional Index)
        const adxUrl = `https://www.alphavantage.co/query?function=ADX&symbol=${symbol}&interval=daily&time_period=14&apikey=${API_KEY}`;
        const adxResponse = await fetch(adxUrl);
        const adxData = await adxResponse.json();
        
        if (adxData['Technical Analysis: ADX']) {
            const latestDate = Object.keys(adxData['Technical Analysis: ADX'])[0];
            const adxValue = parseFloat(adxData['Technical Analysis: ADX'][latestDate]['ADX']);
            technicals.indicators.adx = {
                value: adxValue,
                date: latestDate,
                trend: adxValue > 25 ? 'Strong' : 'Weak'
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(technicals)
        };

    } catch (error) {
        console.error(`[technical-indicators.js] Error:`, error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
