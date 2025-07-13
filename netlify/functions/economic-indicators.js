// netlify/functions/economic-indicators.js
// Fetches economic indicators and commodities data from Alpha Vantage

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

    const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
    if (!API_KEY) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'API key not configured' })
        };
    }

    try {
        console.log(`[economic-indicators.js] Fetching economic data`);
        
        const economicData = {
            timestamp: new Date().toISOString(),
            indicators: {},
            commodities: {},
            crypto: {}
        };

        // Fetch Federal Funds Rate
        const fedFundsUrl = `https://www.alphavantage.co/query?function=FEDERAL_FUNDS_RATE&interval=monthly&apikey=${API_KEY}`;
        const fedFundsResponse = await fetch(fedFundsUrl);
        const fedFundsData = await fedFundsResponse.json();
        
        if (fedFundsData.data && fedFundsData.data.length > 0) {
            economicData.indicators.federalFundsRate = {
                value: parseFloat(fedFundsData.data[0].value),
                date: fedFundsData.data[0].date,
                unit: '%'
            };
        }

        // Fetch CPI (Consumer Price Index)
        const cpiUrl = `https://www.alphavantage.co/query?function=CPI&interval=monthly&apikey=${API_KEY}`;
        const cpiResponse = await fetch(cpiUrl);
        const cpiData = await cpiResponse.json();
        
        if (cpiData.data && cpiData.data.length > 0) {
            economicData.indicators.cpi = {
                value: parseFloat(cpiData.data[0].value),
                date: cpiData.data[0].date,
                unit: 'index'
            };
        }

        // Fetch Unemployment Rate
        const unemploymentUrl = `https://www.alphavantage.co/query?function=UNEMPLOYMENT&apikey=${API_KEY}`;
        const unemploymentResponse = await fetch(unemploymentUrl);
        const unemploymentData = await unemploymentResponse.json();
        
        if (unemploymentData.data && unemploymentData.data.length > 0) {
            economicData.indicators.unemploymentRate = {
                value: parseFloat(unemploymentData.data[0].value),
                date: unemploymentData.data[0].date,
                unit: '%'
            };
        }

        // Fetch Treasury Yield (10 Year)
        const treasuryUrl = `https://www.alphavantage.co/query?function=TREASURY_YIELD&interval=monthly&maturity=10year&apikey=${API_KEY}`;
        const treasuryResponse = await fetch(treasuryUrl);
        const treasuryData = await treasuryResponse.json();
        
        if (treasuryData.data && treasuryData.data.length > 0) {
            economicData.indicators.treasury10Year = {
                value: parseFloat(treasuryData.data[0].value),
                date: treasuryData.data[0].date,
                unit: '%'
            };
        }

        // Fetch WTI Crude Oil
        const wtiUrl = `https://www.alphavantage.co/query?function=WTI&interval=daily&apikey=${API_KEY}`;
        const wtiResponse = await fetch(wtiUrl);
        const wtiData = await wtiResponse.json();
        
        if (wtiData.data && wtiData.data.length > 0) {
            economicData.commodities.wtiCrude = {
                value: parseFloat(wtiData.data[0].value),
                date: wtiData.data[0].date,
                unit: 'USD per barrel'
            };
        }

        // Fetch Natural Gas
        const gasUrl = `https://www.alphavantage.co/query?function=NATURAL_GAS&interval=daily&apikey=${API_KEY}`;
        const gasResponse = await fetch(gasUrl);
        const gasData = await gasResponse.json();
        
        if (gasData.data && gasData.data.length > 0) {
            economicData.commodities.naturalGas = {
                value: parseFloat(gasData.data[0].value),
                date: gasData.data[0].date,
                unit: 'USD per MMBtu'
            };
        }

        // Fetch Bitcoin
        const btcUrl = `https://www.alphavantage.co/query?function=DIGITAL_CURRENCY_DAILY&symbol=BTC&market=USD&apikey=${API_KEY}`;
        const btcResponse = await fetch(btcUrl);
        const btcData = await btcResponse.json();
        
        if (btcData['Time Series (Digital Currency Daily)']) {
            const latestDate = Object.keys(btcData['Time Series (Digital Currency Daily)'])[0];
            const latestData = btcData['Time Series (Digital Currency Daily)'][latestDate];
            economicData.crypto.bitcoin = {
                value: parseFloat(latestData['4a. close (USD)']),
                date: latestDate,
                unit: 'USD'
            };
        }

        // Fetch USD Index (DXY proxy using EUR/USD)
        const dxyUrl = `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=EUR&to_symbol=USD&apikey=${API_KEY}`;
        const dxyResponse = await fetch(dxyUrl);
        const dxyData = await dxyResponse.json();
        
        if (dxyData['Time Series FX (Daily)']) {
            const latestDate = Object.keys(dxyData['Time Series FX (Daily)'])[0];
            const eurUsd = parseFloat(dxyData['Time Series FX (Daily)'][latestDate]['4. close']);
            // DXY approximation (inverse of EUR/USD with adjustment)
            economicData.indicators.dollarIndex = {
                value: (1 / eurUsd * 100).toFixed(2),
                date: latestDate,
                unit: 'index'
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(economicData)
        };

    } catch (error) {
        console.error(`[economic-indicators.js] Error:`, error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
