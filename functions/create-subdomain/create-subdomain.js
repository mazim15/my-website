const Airtable = require('airtable');

// Initialize Airtable
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID);

const NETLIFY_SITE_URL = 'plumbingservicesusa.netlify.app'; // Removed https:// as it's not needed for DNS
const DOMAIN = 'gowso.online'; // Removed https:// as it's not needed for DNS
const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

// Helper function for Cloudflare API calls
async function cfApiCall(endpoint, method = 'GET', data = null) {
  const url = `${CF_API_BASE}${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);
  const result = await response.json();

  if (!result.success) {
    throw new Error(`Cloudflare API error: ${result.errors[0].message}`);
  }

  return result.result;
}

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Validate environment variables
    if (!process.env.CLOUDFLARE_API_TOKEN) {
      throw new Error('CLOUDFLARE_API_TOKEN is not set');
    }
    if (!process.env.CLOUDFLARE_ZONE_ID) {
      throw new Error('CLOUDFLARE_ZONE_ID is not set');
    }
    if (!process.env.AIRTABLE_API_KEY) {
      throw new Error('AIRTABLE_API_KEY is not set');
    }
    if (!process.env.AIRTABLE_BASE_ID) {
      throw new Error('AIRTABLE_BASE_ID is not set');
    }
    if (!process.env.NETLIFY_SITE_ID) {
      throw new Error('NETLIFY_SITE_ID is not set');
    }
    if (!process.env.NETLIFY_ACCESS_TOKEN) {
      throw new Error('NETLIFY_ACCESS_TOKEN is not set');
    }

    console.log('Testing Cloudflare API connection...');
    
    // Test Cloudflare API by getting zone details
    try {
      const zoneDetails = await cfApiCall(`/zones/${process.env.CLOUDFLARE_ZONE_ID}`);
      console.log('Cloudflare API connection successful:', zoneDetails.name);
    } catch (error) {
      console.error('Error testing Cloudflare API:', error);
      throw new Error(`Failed to test Cloudflare API: ${error.message}`);
    }

    console.log('Fetching records from Airtable...');
    
    // Get all businesses from Airtable that don't have subdomains yet
    const records = await base('Businesses').select({
      filterByFormula: '{subdomain_created} = 0'
    }).firstPage();

    // Validate records
    if (!records || records.length === 0) {
      console.log('No records found in Airtable');
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'No businesses found that need subdomains',
          records_found: 0
        })
      };
    }

    console.log(`Found ${records.length} businesses to process`);
    const results = [];

    for (let record of records) {
      try {
        // Get business details from Airtable with detailed logging
        const businessName = record.get('business_name');
        console.log('Processing record:', record.id, 'Business name:', businessName);

        if (!businessName) {
          console.error(`Missing business name for record ${record.id}`);
          results.push({
            record_id: record.id,
            error: 'Missing business name',
            status: 'failed'
          });
          continue;
        }

        const businessData = {
          name: businessName,
          address: record.get('address') || '',
          phone: record.get('phone') || '',
          maps: record.get('maps_url') || '',
        };

        // Create subdomain-safe business name
        const subdomain = businessData.name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric with hyphens
          .replace(/-+/g, '-')        // Replace multiple hyphens with single hyphen
          .replace(/^-|-$/g, '');     // Remove leading/trailing hyphens

        console.log(`Creating DNS record for ${subdomain}.${DOMAIN}`);

        // Create DNS record in Cloudflare
        const dnsResult = await cfApiCall(
          `/zones/${process.env.CLOUDFLARE_ZONE_ID}/dns_records`,
          'POST',
          {
            type: 'CNAME',
            name: subdomain,
            content: NETLIFY_SITE_URL,
            proxied: true,
            ttl: 1
          }
        );

        console.log('DNS record created:', dnsResult);

        // Create page rule for caching
        const pageRuleResult = await cfApiCall(
          `/zones/${process.env.CLOUDFLARE_ZONE_ID}/pagerules`,
          'POST',
          {
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
          }
        );

        console.log('Page rule created:', pageRuleResult);

        // Store business data in Netlify environment variables
        const envVars = {
          [`BUSINESS_NAME_${subdomain}`]: businessData.name,
          [`BUSINESS_ADDRESS_${subdomain}`]: businessData.address,
          [`BUSINESS_PHONE_${subdomain}`]: businessData.phone,
          [`BUSINESS_MAPS_${subdomain}`]: businessData.maps
        };

        // Create environment variables in Netlify
        for (const [key, value] of Object.entries(envVars)) {
          const response = await fetch(`https://api.netlify.com/api/v1/sites/${process.env.NETLIFY_SITE_ID}/env/${key}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ value })
          });

          if (!response.ok) {
            throw new Error(`Failed to set Netlify environment variable ${key}: ${response.statusText}`);
          }
        }

        console.log(`Created environment variables for ${subdomain}`);

        // Update Airtable record to mark subdomain as created
        await base('Businesses').update(record.id, {
          'subdomain_created': true,
          'subdomain': `${subdomain}.${DOMAIN}`
        });

        console.log(`Updated Airtable record for ${subdomain}`);

        results.push({
          business: businessData.name,
          subdomain: `${subdomain}.${DOMAIN}`,
          status: 'success'
        });

      } catch (error) {
        console.error(`Error processing record ${record.id}:`, error);
        results.push({
          business: record.get('business_name') || record.id,
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
        details: error.message,
        stack: error.stack, // Include stack trace for debugging
        env: { // Include environment variable status (but not values) for debugging
          CLOUDFLARE_API_TOKEN: !!process.env.CLOUDFLARE_API_TOKEN,
          CLOUDFLARE_ZONE_ID: !!process.env.CLOUDFLARE_ZONE_ID,
          AIRTABLE_API_KEY: !!process.env.AIRTABLE_API_KEY,
          AIRTABLE_BASE_ID: !!process.env.AIRTABLE_BASE_ID,
          NETLIFY_SITE_ID: !!process.env.NETLIFY_SITE_ID,
          NETLIFY_ACCESS_TOKEN: !!process.env.NETLIFY_ACCESS_TOKEN
        }
      })
    };
  }
};
