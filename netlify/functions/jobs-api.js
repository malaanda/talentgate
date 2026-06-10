const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
    try {
        let store;
        try {
            store = getStore({
                name: 'job-board',
                siteID: process.env.NETLIFY_SITE_ID || undefined,
                token: process.env.NETLIFY_API_TOKEN || undefined
            });
        } catch (e) {
            console.warn("Netlify Blobs local environment missing. Falling back gracefully.");
            if (event.httpMethod === 'GET') {
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify([{
                        id: 'dummy_job_demo',
                        title: 'Senior Software Engineer (Dummy Demo)',
                        employerCompany: 'TechCorp Industries',
                        industry: 'Construction', // Maps to Services & Support
                        location: 'Sydney, NSW',
                        type: 'Full-time / Permanent',
                        description: 'We are seeking a highly skilled Senior Software Engineer to join our growing tech division. You will be responsible for designing and building scalable applications, mentoring junior developers, and contributing to core system architecture. <br><br><strong>Key Requirements:</strong><br>• 5+ years of experience in full-stack development<br>• Proficiency in Node.js, React, and serverless infrastructure<br>• Strong communication skills and leadership potential<br><br><strong>Benefits:</strong><br>• $150,000 - $180,000 + Superannuation<br>• Flexible working arrangements<br>• Visa Sponsorship Available for the right candidate.',
                        datePosted: new Date().toISOString(),
                        dateClosing: new Date(Date.now() + 30*24*60*60*1000).toISOString() // +30 days
                    }])
                };
            }
            return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, dummyFallback: true }) };
        }

        // 1. PUBLIC ENDPOINT: Fetch Jobs
        if (event.httpMethod === 'GET') {
            const jobsBlob = await store.get('active-jobs');
            const jobs = jobsBlob ? JSON.parse(jobsBlob) : [];
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(jobs)
            };
        }

        // 2. ADMIN ENDPOINTS: Verify Authentication (Supports both secure custom Token & Netlify Identity)
        const API_TOKEN = process.env.TALENTGATE_API_TOKEN || "TalentGate_Secret_CRM_Token_2026!";
        const authHeader = event.headers.authorization || event.headers.Authorization;
        const clientToken = authHeader && authHeader.split(' ')[1];
        
        const { user } = context.clientContext || {};
        const isNetlifyAdmin = user && user.app_metadata && user.app_metadata.roles && user.app_metadata.roles.includes('admin');
        
        if (clientToken !== API_TOKEN && !isNetlifyAdmin) {
            return {
                statusCode: 403,
                body: JSON.stringify({ error: "Forbidden. Authorized client token or Netlify admin login required." })
            };
        }

        if (event.httpMethod === 'POST') {
            // Create a new job
            const newJob = JSON.parse(event.body);
            if (!newJob.title || !newJob.industry) {
                return { statusCode: 400, body: JSON.stringify({ error: "Missing required job fields" }) };
            }

            const jobsBlob = await store.get('active-jobs');
            const jobs = jobsBlob ? JSON.parse(jobsBlob) : [];

            // Add ID if not present, otherwise edit existing
            if (!newJob.id) {
                newJob.id = 'job_' + Date.now();
                jobs.unshift(newJob);
            } else {
                const index = jobs.findIndex(j => j.id === newJob.id);
                if (index !== -1) {
                    jobs[index] = newJob; // Update existing job
                } else {
                    jobs.unshift(newJob); // Fallback
                }
            }

            await store.set('active-jobs', JSON.stringify(jobs));

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: true, job: newJob })
            };

        } else if (event.httpMethod === 'DELETE') {
            // Delete a job
            const { jobId } = JSON.parse(event.body);
            if (!jobId) {
                return { statusCode: 400, body: JSON.stringify({ error: "Missing jobId" }) };
            }

            const jobsBlob = await store.get('active-jobs');
            let jobs = jobsBlob ? JSON.parse(jobsBlob) : [];

            jobs = jobs.filter(j => j.id !== jobId);
            await store.set('active-jobs', JSON.stringify(jobs));

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: true })
            };
        }

        return {
            statusCode: 405,
            body: "Method Not Allowed"
        };

    } catch (error) {
        console.error("Job Board API Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal Server Error" })
        };
    }
};
