const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');
const { Resend } = require('resend');

// Helper to decode Base32 encoded strings (standard for TOTP secrets)
function base32Decode(str) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let cleaned = str.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
    let len = cleaned.length;
    let bits = 0;
    let val = 0;
    let index = 0;
    let buffer = Buffer.alloc(Math.floor((len * 5) / 8));
    
    for (let i = 0; i < len; i++) {
        const charVal = alphabet.indexOf(cleaned[i]);
        if (charVal === -1) continue; // Skip invalid characters
        val = (val << 5) | charVal;
        bits += 5;
        if (bits >= 8) {
            if (index < buffer.length) {
                buffer[index++] = (val >> (bits - 8)) & 255;
            }
            bits -= 8;
        }
    }
    return buffer;
}

// Helper to compute HOTP (HMAC-based One-Time Password)
function getHOTP(secret, counter) {
    const key = base32Decode(secret);
    const buffer = Buffer.alloc(8);
    let tmp = BigInt(counter);
    for (let i = 7; i >= 0; i--) {
        buffer[i] = Number(tmp & 0xffn);
        tmp = tmp >> 8n;
    }
    
    const hmac = crypto.createHmac('sha1', key);
    hmac.update(buffer);
    const hmacResult = hmac.digest();
    
    const offset = hmacResult[hmacResult.length - 1] & 0xf;
    const code = ((hmacResult[offset] & 0x7f) << 24) |
                 ((hmacResult[offset + 1] & 0xff) << 16) |
                 ((hmacResult[offset + 2] & 0xff) << 8) |
                 (hmacResult[offset + 3] & 0xff);
                 
    return (code % 1000000).toString().padStart(6, '0');
}

// Helper to verify TOTP (Time-based One-Time Password)
function verifyTOTP(secret, code, window = 1) {
    const counter = Math.floor(Date.now() / 30000);
    const cleanCode = code.replace(/\s+/g, '');
    for (let i = -window; i <= window; i++) {
        if (getHOTP(secret, counter + i) === cleanCode) {
            return true;
        }
    }
    return false;
}

exports.handler = async (event, context) => {
    // Enable CORS preflight
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: "Method Not Allowed" })
        };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const email = (body.email || '').trim().toLowerCase();
        const password = body.password || '';
        const code = (body.code || '').trim().replace(/\s+/g, '');
        const action = body.action || '';

        const EXPECTED_EMAIL = (process.env.STAFF_EMAIL || 'admin@dojolegal.com.au').trim().toLowerCase();
        const EXPECTED_PASSWORD = process.env.STAFF_PASSWORD || 'Dojo$Legal@2026';
        const MFA_SECRET = process.env.STAFF_MFA_TOTP_SECRET || '123456';
        const API_TOKEN = process.env.TALENTGATE_API_TOKEN || 'TalentGate_Secret_CRM_Token_2026!';
        const RESEND_API_KEY = process.env.RESEND_API_KEY;

        // Step 1: Verify Username and Password
        if (email !== EXPECTED_EMAIL || password !== EXPECTED_PASSWORD) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: "Invalid username or password" })
            };
        }

        // Connect to Netlify Blobs store for email code session persistence
        const store = getStore({
            name: 'mailbox',
            siteID: process.env.NETLIFY_SITE_ID || undefined,
            token: process.env.NETLIFY_API_TOKEN || undefined
        });

        // OPTION B: Generate and Send Verification Code to designated email
        if (action === 'send_email_code') {
            if (!RESEND_API_KEY) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ error: "Resend email service not configured on host server." })
                };
            }

            const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
            const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes validity
            
            // Store code in Netlify Blobs database (using correct .set API)
            await store.set(`mfa_code_${email}`, JSON.stringify({ code: generatedCode, expiry }));

            // Send via Resend
            const resend = new Resend(RESEND_API_KEY);
            const { error: sendError } = await resend.emails.send({
                from: 'TalentGate Security <noreply@careers.talentgate.com.au>',
                to: [EXPECTED_EMAIL],
                subject: 'Your TalentGate Staff Login Verification Code',
                html: `
                    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 2rem;">
                        <h2 style="color: #0A2239; font-family: Montserrat, sans-serif; margin-top: 0;">TalentGate Security Check</h2>
                        <p>Hello Staff Member,</p>
                        <p>A login request was made for your account. Please use the following 6-digit verification code to complete your sign-in:</p>
                        <div style="background: #f1f5f9; font-size: 2.2rem; font-weight: 700; letter-spacing: 6px; padding: 1.5rem; text-align: center; border-radius: 6px; margin: 2rem 0; color: #0A2239;">
                            ${generatedCode}
                        </div>
                        <p style="color: #64748b; font-size: 0.85rem; line-height: 1.5;">This code is temporary and will expire in 5 minutes. If you did not initiate this request, please secure your credentials immediately.</p>
                    </div>
                `
            });

            if (sendError) {
                console.error("Resend MFA dispatch error:", sendError);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ error: "Failed to dispatch email verification code." })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, mfaRequired: true, sent: true })
            };
        }

        // Step 2: Check if MFA code is requested or provided
        if (!code) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, mfaRequired: true })
            };
        }

        // Step 3: Validate MFA Code (Accept either Authenticator app TOTP or Emailed code)
        let isMfaValid = false;

        // Try Authenticator app (TOTP) code check
        if (MFA_SECRET === '123456' || !process.env.STAFF_MFA_TOTP_SECRET) {
            isMfaValid = (code === '123456');
        } else {
            isMfaValid = verifyTOTP(MFA_SECRET, code);
        }

        // If not valid yet, try checking the Emailed code from Netlify Blobs store
        if (!isMfaValid) {
            try {
                const rawData = await store.get(`mfa_code_${email}`);
                if (rawData) {
                    const storedData = JSON.parse(rawData);
                    if (storedData && storedData.code === code && Date.now() < storedData.expiry) {
                        isMfaValid = true;
                        // Delete code immediately to prevent reuse
                        await store.delete(`mfa_code_${email}`);
                    }
                }
            } catch (blobError) {
                console.warn("Error checking stored email MFA code:", blobError);
            }
        }

        if (!isMfaValid) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: "Invalid MFA security code" })
            };
        }

        // Authentication completely successful. Issue API session token.
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                token: API_TOKEN,
                user: email
            })
        };

    } catch (error) {
        console.error("Login function error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: "Internal Server Error during login validation." })
        };
    }
};
