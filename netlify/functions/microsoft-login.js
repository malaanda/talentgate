exports.handler = async (event, context) => {
    try {
        const clientID = process.env.MICROSOFT_CLIENT_ID;
        
        // If Microsoft credentials are not configured in Netlify's environment, enable dev simulation mode
        if (!clientID || clientID.trim() === "" || clientID === "PLACEHOLDER") {
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    simulate: true,
                    message: "Simulation mode active (Credentials not found in environment)."
                })
            };
        }

        const tenantID = process.env.MICROSOFT_TENANT_ID || 'common';
        const redirectURI = process.env.MICROSOFT_REDIRECT_URI || `${event.headers.host ? 'https://' + event.headers.host : ''}/.netlify/functions/microsoft-callback`;
        
        // Build Entra ID (Azure AD) secure OAuth 2.0 Auth Redirect URI
        const authUrl = `https://login.microsoftonline.com/${tenantID}/oauth2/v2.0/authorize` +
            `?client_id=${encodeURIComponent(clientID)}` +
            `&response_type=code` +
            `&redirect_uri=${encodeURIComponent(redirectURI)}` +
            `&response_mode=query` +
            `&scope=User.Read` +
            `&state=talentgate_secure_state_${Date.now()}`;

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                simulate: false,
                redirectUrl: authUrl
            })
        };
    } catch (error) {
        console.error("Microsoft Login Function Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal Server Error" })
        };
    }
};
