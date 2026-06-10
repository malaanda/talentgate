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
            console.warn("Netlify Blobs local environment missing. Falling back gracefully to demo feed.");
            // Return dummy job feed for local development testing
            const dummyJobs = [{
                id: 'dummy_job_demo',
                title: 'Senior Software Engineer (Dummy Demo)',
                employerCompany: 'TechCorp Industries',
                industry: 'Construction',
                location: 'Sydney, NSW',
                type: 'Full-time / Permanent',
                description: 'We are seeking a highly skilled Senior Software Engineer to join our growing tech division. You will be responsible for designing and building scalable applications, mentoring junior developers, and contributing to core system architecture. <br><br><strong>Key Requirements:</strong><br>• 5+ years of experience in full-stack development<br>• Proficiency in Node.js, React, and serverless infrastructure<br>• Strong communication skills and leadership potential<br><br><strong>Benefits:</strong><br>• $150,000 - $180,000 + Superannuation<br>• Flexible working arrangements<br>• Visa Sponsorship Available for the right candidate.',
                datePosted: new Date().toISOString(),
                dateClosing: new Date(Date.now() + 30*24*60*60*1000).toISOString()
            }];
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/xml; charset=utf-8' },
                body: generateXmlFeed(dummyJobs)
            };
        }

        const jobsBlob = await store.get('active-jobs');
        const jobs = jobsBlob ? JSON.parse(jobsBlob) : [];

        return {
            statusCode: 200,
            headers: { 
                'Content-Type': 'application/xml; charset=utf-8',
                'Access-Control-Allow-Origin': '*' // Allow job boards to query the feed directly
            },
            body: generateXmlFeed(jobs)
        };

    } catch (error) {
        console.error("Job Feed Error:", error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/xml; charset=utf-8' },
            body: '<?xml version="1.0" encoding="utf-8"?><error>Internal Server Error</error>'
        };
    }
};

function generateXmlFeed(jobs) {
    let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
    xml += '<source>\n';
    xml += '  <publisher>TalentGate</publisher>\n';
    xml += '  <publisherurl>https://talentgate.com.au</publisherurl>\n';
    xml += `  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n`;

    jobs.forEach(job => {
        // Parse city/state from location (e.g. "Sydney, NSW" -> city: "Sydney", state: "NSW")
        let city = 'Sydney';
        let state = 'NSW';
        if (job.location && job.location.includes(',')) {
            const parts = job.location.split(',');
            city = parts[0].trim();
            state = parts[1].trim();
        } else if (job.location) {
            city = job.location.trim();
        }

        // Escape helper for CDATA tags
        const cleanTitle = escapeCdata(job.title);
        const cleanCompany = escapeCdata(job.employerCompany || 'TalentGate Client');
        const cleanDesc = escapeCdata(job.description);
        const cleanType = escapeCdata(job.type || 'Full-time');
        const cleanSalary = escapeCdata(job.salary || '');
        const cleanCategory = escapeCdata(job.industry || '');

        const applyUrl = `https://talentgate.com.au/jobs.html?job=${encodeURIComponent(job.title)}`;

        xml += '  <job>\n';
        xml += `    <title><![CDATA[${cleanTitle}]]></title>\n`;
        xml += `    <date><![CDATA[${new Date(job.datePosted || Date.now()).toUTCString()}]]></date>\n`;
        xml += `    <referencenumber><![CDATA[${job.id}]]></referencenumber>\n`;
        xml += `    <url><![CDATA[${applyUrl}]]></url>\n`;
        xml += `    <company><![CDATA[${cleanCompany}]]></company>\n`;
        xml += `    <city><![CDATA[${city}]]></city>\n`;
        xml += `    <state><![CDATA[${state}]]></state>\n`;
        xml += '    <country><![CDATA[AU]]></country>\n';
        xml += `    <description><![CDATA[${cleanDesc}]]></description>\n`;
        xml += `    <salary><![CDATA[${cleanSalary}]]></salary>\n`;
        xml += `    <jobtype><![CDATA[${cleanType}]]></jobtype>\n`;
        xml += `    <category><![CDATA[${cleanCategory}]]></category>\n`;
        xml += '  </job>\n';
    });

    xml += '</source>';
    return xml;
}

function escapeCdata(str) {
    if (!str) return '';
    return str.replace(/]]>/g, ']]&gt;');
}
