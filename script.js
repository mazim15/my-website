const templates = [
    `Hi [Business Name],

I noticed your business is listed on Google Maps but doesn't have a website. I put together a sample site for you to see how it could boost your presence:
[example.gowso.online]

A website can:

Help more people find you.
Show your services and contact info.
Build trust with reviews and testimonials.

Let me know if this interests you, and I can help set it up on your domain!`,
    
    `Hi [Business Name],

Many people check for a website after finding you on Google Maps. Without one, you could be missing opportunities.

Take a look at this sample I made for you: [example.gowso.online]

With a website, customers can learn more about your services, trust your business, and contact you easily. Reply if you'd like to know more!`,
    
    `Hi [Business Name],

Your Google Maps listing is a great start, but many customers look for a website before deciding who to contact.

Here's a sample website I created for you: [example.gowso.online]

With a website, you can:

Get more inquiries from interested customers.
Show a polished, professional presence.
Make it simple for people to contact you.

Let me know if you'd like to learn how to make this your own!`,

    `Hi [Business Name],

When someone has a plumbing issue, they often search online for a reliable service. A website can help them find and trust you quickly.

I created this sample for you: [example.gowso.online]

It shows how customers can:

Reach you right away.
Learn about your services.
Feel confident in choosing you.

Reply if you'd like to set this up for your business!`,

    `Hi [Business Name],

I made a sample website for your business to show how you can connect with more customers:
[example.gowso.online]

A website can:

Help people find your services.
Build trust with testimonials and reviews.
Make it easy to reach you.

I'm offering this service at a low cost for select businesses. Let me know if you're interested in learning more!`,

];

function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(header => header.trim());
    
    return lines.slice(1).map(line => {
        let values = [];
        let currentValue = '';
        let insideQuotes = false;
        
        for (let char of line) {
            if (char === '"') {
                insideQuotes = !insideQuotes;
            } else if (char === ',' && !insideQuotes) {
                values.push(currentValue.trim());
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        values.push(currentValue.trim());
        
        const business = {};
        headers.forEach((header, index) => {
            let value = values[index] || '';
            value = value.replace(/^"|"$/g, '').trim();
            business[header] = value;
        });
        
        return business;
    });
}

function getRandomTemplate() {
    return templates[Math.floor(Math.random() * templates.length)];
}

function generateMessage(business) {
    const template = getRandomTemplate();
    const websiteUrl = `https://${business.subdomain}.gowso.online`;
    return template
        .replace(/\[Business Name\]/g, business.business_name)
        .replace(/\[example\.gowso\.online\]/g, websiteUrl);
}

function generateStaticHTML(businesses) {
    const cards = businesses.map(business => {
        if (!business.business_name || !business.subdomain || !business.phone) {
            return '';
        }

        const message = generateMessage(business);
        return `
            <div class="business-card">
                <div class="business-info">
                    <div class="business-name">${business.business_name}</div>
                    <div class="business-details">
                        Phone: ${business.phone}<br>
                        Website: ${business.subdomain}.gowso.online
                    </div>
                </div>
                <div class="message-area">${message}</div>
                <button class="copy-btn" onclick="copyMessage(this, \`${message.replace(/`/g, '\\`')}\`)">Copy Message</button>
            </div>
        `;
    }).join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Business Messages</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: Arial, sans-serif;
            background-color: #f0f2f5;
            padding: 20px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .header h1 {
            color: #1a73e8;
            margin-bottom: 10px;
        }

        .business-card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .business-info {
            margin-bottom: 15px;
            padding-bottom: 15px;
            border-bottom: 1px solid #eee;
        }

        .business-name {
            font-size: 1.2em;
            font-weight: bold;
            color: #1a73e8;
        }

        .business-details {
            color: #666;
            margin-top: 5px;
            line-height: 1.5;
        }

        .message-area {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            margin-top: 10px;
            white-space: pre-wrap;
            line-height: 1.5;
        }

        .copy-btn {
            background: #1a73e8;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 10px;
            transition: background 0.3s;
            width: 100%;
            font-size: 1.1em;
            height: 44px; /* Make buttons easier to tap on mobile */
        }

        .copy-btn:hover {
            background: #1557b0;
        }

        .copied {
            background: #34a853;
        }

        @media (max-width: 768px) {
            body {
                padding: 10px;
            }
            
            .business-card {
                padding: 15px;
            }
            
            .message-area {
                font-size: 0.95em;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Business Messages</h1>
        </div>
        <div id="businessContainer">
            ${cards}
        </div>
    </div>
    <script>
        async function copyMessage(button, message) {
            try {
                await navigator.clipboard.writeText(message);
                button.textContent = 'Copied!';
                button.style.backgroundColor = '#34a853';
                setTimeout(() => {
                    button.textContent = 'Copy Message';
                    button.style.backgroundColor = '#1a73e8';
                }, 2000);
            } catch (error) {
                console.error('Failed to copy:', error);
                // Fallback for mobile devices
                const textarea = document.createElement('textarea');
                textarea.value = message;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                try {
                    document.execCommand('copy');
                    button.textContent = 'Copied!';
                    button.style.backgroundColor = '#34a853';
                    setTimeout(() => {
                        button.textContent = 'Copy Message';
                        button.style.backgroundColor = '#1a73e8';
                    }, 2000);
                } catch (err) {
                    console.error('Fallback failed:', err);
                    button.textContent = 'Failed to copy';
                }
                document.body.removeChild(textarea);
            }
        }
    </script>
</body>
</html>`;
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv';
    fileInput.style.margin = '20px';
    
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const text = await file.text();
                const businesses = parseCSV(text);
                
                // Generate static HTML
                const staticHTML = generateStaticHTML(businesses);
                
                // Create and download the static HTML file
                const blob = new Blob([staticHTML], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'business-messages.html';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                // Also display the cards on the current page
                createBusinessCards(businesses);
            } catch (error) {
                console.error('Error reading file:', error);
                document.getElementById('businessContainer').innerHTML = 
                    `<div class="loading">Error reading file: ${error.message}</div>`;
            }
        }
    });

    const container = document.getElementById('businessContainer');
    container.parentNode.insertBefore(fileInput, container);
});

function createBusinessCards(businesses) {
    const container = document.getElementById('businessContainer');
    container.innerHTML = '';
    
    businesses.forEach(business => {
        if (!business.business_name || !business.subdomain || !business.phone) {
            console.warn('Skipping business with missing data:', business);
            return;
        }

        const message = generateMessage(business);
        const card = document.createElement('div');
        card.className = 'business-card';
        
        card.innerHTML = `
            <div class="business-info">
                <div class="business-name">${business.business_name}</div>
                <div class="business-details">
                    Phone: ${business.phone}<br>
                    Website: ${business.subdomain}.gowso.online
                </div>
            </div>
            <div class="message-area">${message}</div>
            <button class="copy-btn" onclick="copyMessage(this, \`${message.replace(/`/g, '\\`')}\`)">Copy Message</button>
        `;
        
        container.appendChild(card);
    });
}
