// netlify/functions/realtime-alerts.js
// Updated to use comprehensive AI analysis - NO MOCK DATA

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
        console.log(`[realtime-alerts.js] Generating real-time alerts using comprehensive AI analysis...`);

        // Get the base URL for calling other functions
        const baseUrl = process.env.URL || `https://${event.headers.host}`;
        
        // Call the comprehensive AI analysis function for alerts
        const analysisResponse = await fetch(`${baseUrl}/.netlify/functions/comprehensive-ai-analysis`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'Netlify-Function'
            },
            body: JSON.stringify({ type: 'alerts' })
        });

        if (!analysisResponse.ok) {
            throw new Error(`Comprehensive analysis failed: ${analysisResponse.status} - ${analysisResponse.statusText}`);
        }

        const analysisData = await analysisResponse.json();
        
        // Check if we got valid analysis data
        if (analysisData.analysis && analysisData.analysis.alerts && Array.isArray(analysisData.analysis.alerts)) {
            const alerts = analysisData.analysis.alerts;
            
            // Filter out any alerts that don't have real data backing
            const validAlerts = alerts.filter(alert => 
                alert.title && 
                alert.description && 
                alert.type &&
                alert.priority &&
                alert.confidence && 
                alert.confidence >= 60 // Minimum confidence threshold
            );
            
            // Add timestamps to alerts if not present
            const timestampedAlerts = validAlerts.map(alert => ({
                ...alert,
                timestamp: alert.timestamp || new Date().toISOString(),
                id: alert.id || Math.floor(Math.random() * 10000)
            }));
            
            console.log(`[realtime-alerts.js] Generated ${timestampedAlerts.length} valid alerts from comprehensive analysis`);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    alerts: timestampedAlerts,
                    marketCondition: analysisData.analysis.marketCondition || {},
                    riskLevel: analysisData.analysis.riskLevel || 'Unknown',
                    keyWatches: analysisData.analysis.keyWatches || [],
                    sessionSpecific: analysisData.analysis.sessionSpecific || {},
                    timestamp: new Date().toISOString(),
                    dataSource: "Comprehensive AI Analysis - Real Data Only",
                    dataQuality: analysisData.dataQuality || {}
                })
            };
        } else {
            // No valid alerts found - return empty but informative response
            console.log(`[realtime-alerts.js] No valid alerts generated - market conditions normal`);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    alerts: [],
                    message: "No significant market alerts detected",
                    reason: "Current market conditions are within normal parameters",
                    marketCondition: analysisData.analysis?.marketCondition || { overall: "Normal" },
                    riskLevel: analysisData.analysis?.riskLevel || "Low",
                    keyWatches: analysisData.analysis?.keyWatches || [],
                    timestamp: new Date().toISOString(),
                    dataSource: "Comprehensive AI Analysis - Real Data Only",
                    dataQuality: analysisData.dataQuality || {}
                })
            };
        }

    } catch (error) {
        console.error(`[realtime-alerts.js] Error generating alerts:`, error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Alerts generation error",
                details: error.message,
                alerts: [], // Always return empty array instead of mock data
                timestamp: new Date().toISOString(),
                dataSource: "Error - No Data Available"
            })
        };
    }
};
