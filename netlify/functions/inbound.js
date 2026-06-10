const { getStore } = require('@netlify/blobs');
const { Resend } = require('resend');

exports.handler = async (event, context) => {
    // We only accept POST requests from Resend
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: 'Method Not Allowed'
        };
    }

    try {
        const payload = JSON.parse(event.body);
        console.log("Received email webhook from Resend:", payload);

        // Resend sends the event type in the payload (e.g. 'email.received')
        if (payload.type === 'email.received' && payload.data) {
            const emailData = payload.data;
            
            // Initialize Resend
            const resendKey = process.env.RESEND_API_KEY;
            if (!resendKey) {
                console.error("Missing RESEND_API_KEY environment variable.");
                return {
                    statusCode: 500,
                    body: JSON.stringify({ error: "SMTP configuration error" })
                };
            }
            const resend = new Resend(resendKey);

            // Fetch full email content
            const emailId = emailData.email_id || emailData.id;
            if (!emailId) {
                console.error("No email_id or id found in webhook payload.");
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: "Missing email identifier" })
                };
            }

            let fullEmail = null;
            let getError = null;
            if (emailId.startsWith("email_test_")) {
                fullEmail = {
                    id: emailId,
                    from: emailData.from || '',
                    to: emailData.to || '',
                    subject: emailData.subject || '',
                    html: emailData.html || '',
                    created_at: emailData.created_at || new Date().toISOString(),
                    attachments: []
                };
            } else {
                console.log(`Fetching received email details for ID: ${emailId}`);
                const res = await resend.emails.receiving.get(emailId);
                fullEmail = res.data;
                getError = res.error;
            }

            if (getError) {
                console.error("Resend API error fetching received email:", getError);
                return {
                    statusCode: 500,
                    body: JSON.stringify({ error: "Failed to retrieve email content from Resend", details: getError.message })
                };
            }

            if (!fullEmail) {
                console.error("Resend returned empty email details");
                return {
                    statusCode: 500,
                    body: JSON.stringify({ error: "Empty email details returned" })
                };
            }

            // Extract the core fields from fullEmail
            const fromStr = fullEmail.from || emailData.from || '';
            let fromName = '';
            let fromEmail = '';

            const match = fromStr.match(/^(.*?)\s*<(.*?)>$/);
            if (match) {
                fromName = match[1].replace(/['"]/g, '').trim();
                fromEmail = match[2].trim();
            } else {
                fromEmail = fromStr.trim();
                fromName = fromEmail.split('@')[0];
            }

            const toEmail = Array.isArray(fullEmail.to) ? fullEmail.to[0] : (fullEmail.to || emailData.to || '');
            const subject = fullEmail.subject || '(No Subject)';
            const htmlBody = fullEmail.html || fullEmail.text || '';
            const dateStr = new Date(fullEmail.created_at || emailData.created_at || Date.now()).toLocaleString('en-AU', { timeZone: 'Australia/Perth' }) + ' AWST';

            // Connect to Netlify Blobs to store the email thread
            const store = getStore({
                name: 'mailbox',
                siteID: process.env.NETLIFY_SITE_ID || undefined,
                token: process.env.NETLIFY_API_TOKEN || undefined
            });

            // Get existing threads
            const existingData = await store.get('threads');
            const threads = existingData ? JSON.parse(existingData) : [];

            // Extract attachment metadata (id, filename, contentType)
            const attachmentsList = [];
            if (fullEmail.attachments && Array.isArray(fullEmail.attachments)) {
                fullEmail.attachments.forEach(att => {
                    attachmentsList.push({
                        id: att.id,
                        filename: att.filename || 'attachment',
                        contentType: att.content_type || 'application/octet-stream'
                    });
                });
            }

            // Extract job title from subject if possible
            let cleanSubject = subject.replace(/^(Re|RE|Fwd|FWD)\s*:\s*/i, '').trim();
            let parsedJobTitle = "General Inquiry";
            if (cleanSubject.startsWith("New Application:")) {
                try {
                    const parts = cleanSubject.replace("New Application:", "").split("—");
                    if (parts.length > 0) {
                        parsedJobTitle = parts[0].trim();
                    }
                } catch (e) {
                    console.error("Error parsing job title from subject:", e);
                }
            }

            // Find if there is an existing thread between this sender, mailbox, and job title
            let thread = threads.find(t => t.senderEmail === fromEmail && t.mailbox === toEmail && t.jobTitle === parsedJobTitle);

            const newMsg = {
                id: 'msg_' + Date.now(),
                emailId: emailId,
                sender: fromName,
                senderEmail: fromEmail,
                body: htmlBody,
                date: dateStr,
                timestamp: dateStr,
                direction: 'inbound',
                isOutgoing: false,
                attachments: attachmentsList
            };

            if (thread) {
                // Add message to existing thread
                if (!thread.messages) thread.messages = [];
                thread.messages.push(newMsg);
                thread.unread = true;
                thread.date = dateStr;
                thread.jobTitle = parsedJobTitle;
            } else {
                // Create a new thread
                thread = {
                    id: 'thread_' + Date.now(),
                    senderName: fromName,
                    senderEmail: fromEmail,
                    mailbox: toEmail,
                    subject: subject,
                    date: dateStr,
                    unread: true,
                    visaStatus: "Pending Assessment",
                    jobTitle: parsedJobTitle,
                    messages: [newMsg]
                };
                threads.unshift(thread);
            }

            // Save threads back to Blob store
            await store.set('threads', JSON.stringify(threads));
            console.log(`Successfully saved incoming email from ${fromEmail} to ${toEmail}`);

            // Forward inbound email to support@dojolegal.com.au for backup/saving
            try {
                console.log(`Forwarding incoming email copy from ${fromEmail} to support@dojolegal.com.au`);
                
                // Fetch full attachments from Resend's API to attach them directly
                const forwardAttachments = [];
                if (fullEmail.attachments && Array.isArray(fullEmail.attachments)) {
                    for (const att of fullEmail.attachments) {
                        try {
                            const { data: attData, error: attErr } = await resend.emails.receiving.attachments.get({
                                id: att.id,
                                emailId: emailId
                            });
                            if (attErr) {
                                console.error(`Error fetching attachment ${att.id}:`, attErr);
                                continue;
                            }
                            if (attData && attData.download_url) {
                                const res = await fetch(attData.download_url);
                                if (res.ok) {
                                    const arrayBuffer = await res.arrayBuffer();
                                    const base64 = Buffer.from(arrayBuffer).toString('base64');
                                    forwardAttachments.push({
                                        content: base64,
                                        filename: att.filename || 'attachment'
                                    });
                                } else {
                                    console.error(`Failed to fetch attachment from URL: ${res.statusText}`);
                                }
                            }
                        } catch (err) {
                            console.error(`Failed to download attachment ${att.id}:`, err);
                        }
                    }
                }

                await resend.emails.send({
                    from: `TalentGate Inbound Forwarder <noreply@careers.talentgate.com.au>`,
                    to: ['support@dojolegal.com.au'],
                    replyTo: fromEmail,
                    subject: `[FWD] ${subject}`,
                    html: `
                        <div style="background: #f1f5f9; padding: 15px; border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 20px; font-family: sans-serif; font-size: 13px; color: #475569; line-height: 1.6;">
                            <strong style="color: #0f172a; font-size: 14px;">📬 Forwarded Inbound Email</strong><br>
                            <strong>Sender:</strong> ${fromStr}<br>
                            <strong>Recipient:</strong> ${toEmail}<br>
                            <strong>Received:</strong> ${dateStr}<br>
                            <strong>Attachments:</strong> ${attachmentsList.map(a => a.filename).join(', ') || 'None'}<br>
                            <strong>TalentGate Portal:</strong> <a href="https://talentgate.com.au/admin-emails.html" style="color: #2563eb; text-decoration: underline;">View in CRM Mail Hub</a>
                        </div>
                        ${htmlBody}
                    `,
                    attachments: forwardAttachments.length > 0 ? forwardAttachments : undefined
                });
                console.log("Successfully forwarded inbound copy to support@dojolegal.com.au");
            } catch (fwdErr) {
                console.error("Failed to forward copy to support:", fwdErr);
            }
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true })
        };

    } catch (error) {
        console.error("Inbound Webhook Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal Server Error" })
        };
    }
};
