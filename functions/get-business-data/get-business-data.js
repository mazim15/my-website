// get-business-data.js
const Airtable = require('airtable');

const sanitizeInput = (input) => {
    // Basic input sanitization
    return input.replace(/[^a-zA-Z0-9-]/g, '');
};

exports.handler = async (event) => {
    let { business, subdomain } = event.queryStringParameters;
    
    // Sanitize inputs
    business = business ? sanitizeInput(business) : null;
    subdomain = subdomain ? sanitizeInput(subdomain) : null;
    
    if (!business && !subdomain) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Business or subdomain parameter is required' })
        };
    }

    try {
        const base = new Airtable({
            apiKey: process.env.AIRTABLE_API_KEY
        }).base(process.env.AIRTABLE_BASE_ID);

        // Build the filter formula with proper escaping
        let filterFormula;
        if (business) {
            filterFormula = `LOWER({business_name}) = LOWER('${business}')`;
        } else if (subdomain) {
            filterFormula = `LOWER({subdomain}) = LOWER('${subdomain}')`;
        }

        const records = await base('Businesses')
            .select({
                filterByFormula: filterFormula,
                fields: ['business_name', 'address', 'phone', 'maps_url', 'subdomain']
            })
            .firstPage();

        if (!records || records.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({ 
                    error: 'Business not found',
                    queriedValue: business || subdomain 
                })
            };
        }

        const data = records[0].fields;

        // Add security headers
        const headers = {
            'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET',
            'Content-Security-Policy': "default-src 'self'; frame-src 'self' https://www.google.com",
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'SAMEORIGIN',
            'X-XSS-Protection': '1; mode=block'
        };

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error('Error:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to fetch business data',
                details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            })
        };
    }
};

// Frontend script for index.html
const businessDataHandler = {
    getSubdomain() {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            // For local development, you might want to use a query parameter
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('business');
        }
        
        const parts = hostname.split('.');
        return parts.length >= 3 ? parts[0].toLowerCase() : null;
    },

    async fetchBusinessData() {
        const subdomain = this.getSubdomain();
        if (!subdomain) {
            console.warn('No subdomain found');
            return null;
        }

        try {
            const response = await fetch(`/.netlify/functions/get-business-data?business=${encodeURIComponent(subdomain)}`, {
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching business data:', error);
            this.handleError(error);
            return null;
        }
    },

    replaceContent(data) {
        if (!data) return;

        // Create a template processor
        const processTemplate = (text, data) => {
            return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
                return data[key] !== undefined ? data[key] : match;
            });
        };

        // Process text nodes
        const walk = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;
        while (node = walk.nextNode()) {
            const newText = processTemplate(node.textContent, data);
            if (newText !== node.textContent) {
                node.textContent = newText;
            }
        }

        // Update Google Maps iframe
        if (data.maps_url) {
            const mapsIframes = document.querySelectorAll('iframe[src*="google.com/maps"], iframe[data-maps="true"]');
            mapsIframes.forEach(iframe => {
                // Validate URL
                try {
                    const url = new URL(data.maps_url);
                    if (url.hostname.includes('google.com')) {
                        iframe.src = data.maps_url;
                    }
                } catch (e) {
                    console.error('Invalid maps URL:', e);
                }
            });
        }
    },

    handleError(error) {
        // Add error handling UI if needed
        const errorDiv = document.getElementById('error-message') || document.createElement('div');
        errorDiv.id = 'error-message';
        errorDiv.className = 'error-message';
        errorDiv.textContent = 'Unable to load business data. Please try again later.';
        
        if (!document.getElementById('error-message')) {
            document.body.insertBefore(errorDiv, document.body.firstChild);
        }
    },

    init() {
        document.addEventListener('DOMContentLoaded', async () => {
            const businessData = await this.fetchBusinessData();
            if (businessData) {
                this.replaceContent(businessData);
            }
        });
    }
};

// Initialize the handler
businessDataHandler.init();