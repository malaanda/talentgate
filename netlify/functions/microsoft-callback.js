const https = require('https');

exports.handler = async (event, context) => {
    try {
        const { code, error, error_description } = event.queryStringParameters || {};

        if (error) {
            console.error("Microsoft Auth Error Callback:", error, error_description);
            return renderHtmlRedirect("/login.html", `Microsoft Login Error: ${error_description || error}`);
        }

        if (!code) {
            return renderHtmlRedirect("/login.html", "No authorization code provided by Microsoft identity provider.");
        }

        const clientID = process.env.MICROSOFT_CLIENT_ID;
        const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
        const tenantID = process.env.MICROSOFT_TENANT_ID || 'common';
        const redirectURI = `${event.headers.host ? 'https://' + event.headers.host : ''}/.netlify/functions/microsoft-callback`;

        // 1. Back-channel request to exchange authorization code for an Access Token
        const tokenResponse = await postRequest(
            `https://login.microsoftonline.com/${tenantID}/oauth2/v2.0/token`,
            new URLSearchParams({
                client_id: clientID,
                client_secret: clientSecret,
                code: code,
                redirect_uri: redirectURI,
                grant_type: 'authorization_code'
            }).toString(),
            { 'Content-Type': 'application/x-www-form-urlencoded' }
        );

        const tokenData = JSON.parse(tokenResponse);
        if (!tokenData.access_token) {
            console.error("Failed to retrieve access token from Microsoft:", tokenData);
            return renderHtmlRedirect("/login.html", "Identity verification failed: Access token missing.");
        }

        // 2. Query Microsoft Graph API '/me' endpoint to retrieve authenticated user's email
        const graphResponse = await getRequest(
            `https://graph.microsoft.com/v1.0/me`,
            { 'Authorization': `Bearer ${tokenData.access_token}` }
        );

        const userData = JSON.parse(graphResponse);
        const userEmail = (userData.mail || userData.userPrincipalName || "").toLowerCase().trim();

        // 3. Domain Whitelist Verification Check
        if (!userEmail.endsWith("@talentgate.com.au")) {
            console.warn(`Unauthorized login attempt from: ${userEmail}`);
            return renderHtmlRedirect("/login.html", `Access Denied: Account ${userEmail} is not authorized. You must log in using an official @talentgate.com.au address.`);
        }

        // 4. Secure Redirect: sets session flag and user email in browser localStorage
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: `
                <!DOCTYPE html>
                <html>
                <head><title>Redirecting...</title></head>
                <body>
                    <div style="font-family: sans-serif; text-align: center; margin-top: 10%;">
                        <h2>Authenticating Secure Session...</h2>
                        <p>Verifying details with TalentGate private server. Please wait.</p>
                    </div>
                    <script>
                        localStorage.setItem('tg_admin_session', 'true');
                        localStorage.setItem('tg_admin_user', '${userEmail}');
                        window.location.href = '/applications.html';
                    </script>
                </body>
                </html>
            `
        };

    } catch (err) {
        console.error("Microsoft Callback Exception:", err);
        return renderHtmlRedirect("/login.html", "Internal Server Error occurred during Microsoft authentication.");
    }
};

// Utility function to render a standard HTML redirect page with alert message
function renderHtmlRedirect(targetUrl, errorMessage) {
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html' },
        body: `
            <!DOCTYPE html>
            <html>
            <head><title>Authenticating...</title></head>
            <body>
                <script>
                    alert("${errorMessage.replace(/"/g, '\\"')}");
                    window.location.href = "${targetUrl}";
                </script>
            </body>
            </html>
        `
    };
}

// Promise wrapper for secure HTTPS POST request
function postRequest(url, body, headers) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const options = {
            hostname: u.hostname,
            port: 443,
            path: u.pathname,
            method: 'POST',
            headers: {
                ...headers,
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        });

        req.on('error', (err) => reject(err));
        req.write(body);
        req.end();
    });
}

// Promise wrapper for secure HTTPS GET request
function getRequest(url, headers) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const options = {
            hostname: u.hostname,
            port: 443,
            path: u.pathname + u.search,
            method: 'GET',
            headers: headers
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        });

        req.on('error', (err) => reject(err));
        req.end();
    });
}
