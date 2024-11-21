async function loadBusinessData() {
    try {
        const [businessesResponse, templatesResponse] = await Promise.all([
            fetch('businesses.csv'),
            fetch('templates.txt')
        ]);

        const businessesText = await businessesResponse.text();
        const templatesText = await templatesResponse.text();

        // Parse CSV data
        const businesses = parseCSV(businessesText);
        
        // Parse templates
        const templates = parseTemplates(templatesText);

        // Create business cards
        createBusinessCards(businesses, templates);
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('businessContainer').innerHTML = 
            '<div class="loading">Error loading data. Please try again.</div>';
    }
}

function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',');
    
    return lines.slice(1)
        .filter(line => line.trim())
        .map(line => {
            const values = line.split(',');
            const business = {};
            headers.forEach((header, index) => {
                business[header.trim()] = values[index] ? values[index].trim() : '';
            });
            return business;
        });
}

function parseTemplates(templatesText) {
    return templatesText
        .split(/\d+\.\s+[^]+?(?=\d+\.|$)/)
        .map(template => template.trim())
        .filter(template => template);
}

function getRandomTemplate(templates) {
    return templates[Math.floor(Math.random() * templates.length)];
}

function generateMessage(business, template) {
    const websiteUrl = `https://${business.subdomain}.gowso.online`;
    return template
        .replace('[Business Name]', business.business_name)
        .replace('[example.gowso.online]', websiteUrl);
}

function createBusinessCards(businesses, templates) {
    const container = document.getElementById('businessContainer');
    container.innerHTML = ''; // Clear loading message
    
    businesses.forEach(business => {
        const template = getRandomTemplate(templates);
        const message = generateMessage(business, template);
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

async function copyMessage(button, message) {
    try {
        await navigator.clipboard.writeText(message);
        button.textContent = 'Copied!';
        button.classList.add('copied');
        setTimeout(() => {
            button.textContent = 'Copy Message';
            button.classList.remove('copied');
        }, 2000);
    } catch (error) {
        console.error('Failed to copy:', error);
        button.textContent = 'Failed to copy';
        setTimeout(() => {
            button.textContent = 'Copy Message';
        }, 2000);
    }
}

// Initialize the page
loadBusinessData();
