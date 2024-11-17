const Airtable = require('airtable');
const cloudflare = require('cloudflare');

// Initialize Airtable
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID);

// Initialize Cloudflare
const cf = new cloudflare({
  token: process.env.CLOUDFLARE_API_TOKEN
});

const NETLIFY_SITE_URL = 'https://plumbingservicesusa.netlify.app/'; // Replace with your Netlify site URL
const DOMAIN = 'https://gowso.online/'; // Replace with your actual domain

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get all businesses from Airtable that don't have subdomains yet
    const records = await base('Businesses').select({
      filterByFormula: '{subdomain_created} = 0'
    }).firstPage();

    const results = [];

    for (let record of records) {
      // Get business details from Airtable
      const businessData = {
        name: record.get('business_name'),
        address: record.get('address'),
        phone: record.get('phone'),
        maps: record.get('maps_url'),
      };

      // Create subdomain-safe business name
      const subdomain = businessData.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric with hyphens
        .replace(/-+/g, '-')        // Replace multiple hyphens with single hyphen
        .replace(/^-|-$/g, '');     // Remove leading/trailing hyphens

      try {
        // Create DNS record in Cloudflare
        await cf.dnsRecords.add(process.env.CLOUDFLARE_ZONE_ID, {
          type: 'CNAME',
          name: subdomain,
          content: NETLIFY_SITE_URL,
          proxied: true,
          ttl: 1
        });

        // Optional: Create page rule for caching
        await cf.pageRules.create(process.env.CLOUDFLARE_ZONE_ID, {
          targets: [
            {
              target: 'url',
              constraint: {
                operator: 'matches',
                value: `${subdomain}.${DOMAIN}/*`
              }
            }
          ],
          actions: {
            cache_level: 'cache_everything',
            edge_cache_ttl: 2629746 // Cache for 1 month
          }
        });

        // Store business data in Netlify environment variables
        const envVars = {
          [`BUSINESS_NAME_${subdomain}`]: businessData.name,
          [`BUSINESS_ADDRESS_${subdomain}`]: businessData.address,
          [`BUSINESS_PHONE_${subdomain}`]: businessData.phone,
          [`BUSINESS_MAPS_${subdomain}`]: businessData.maps
        };

        // Create environment variables in Netlify
        for (const [key, value] of Object.entries(envVars)) {
          await fetch(`https://api.netlify.com/api/v1/sites/${process.env.NETLIFY_SITE_ID}/env/${key}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ value })
          });
        }

        // Update Airtable record to mark subdomain as created
        await base('Businesses').update(record.id, {
          'subdomain_created': true,
          'subdomain': `${subdomain}.${DOMAIN}`
        });

        results.push({
          business: businessData.name,
          subdomain: `${subdomain}.${DOMAIN}`,
          status: 'success'
        });

      } catch (error) {
        console.error(`Error processing ${businessData.name}:`, error);
        results.push({
          business: businessData.name,
          error: error.message,
          status: 'failed'
        });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Processing complete',
        results: results
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to process businesses',
        details: error.message
      })
    };
  }
};