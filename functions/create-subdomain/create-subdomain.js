const Airtable = require('airtable');

// Initialize Airtable
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID);

const NETLIFY_SITE_URL = 'plumbingservicesusa.netlify.app'; // The Netlify site URL to point to
const DOMAIN = 'gowso.online'; // The domain for subdomains
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

// Helper function to check if DNS record exists
async function getDnsRecord(zoneId, name) {
  try {
    const records = await cfApiCall(`/zones/${zoneId}/dns_records?name=${name}.${DOMAIN}`);
    return records.length > 0 ? records[0] : null;
  } catch (error) {
    console.error('Error checking DNS record:', error);
    return null;
  }
}

// Helper function to delete existing page rules for a subdomain
async function deleteExistingPageRules(zoneId, subdomain) {
  try {
    const rules = await cfApiCall(`/zones/${zoneId}/pagerules`);
    const subdomainRules = rules.filter(rule => 
      rule.targets[0].constraint.value.includes(`${subdomain}.${DOMAIN}`)
    );
    
    for (const rule of subdomainRules) {
      await cfApiCall(`/zones/${zoneId}/pagerules/${rule.id}`, 'DELETE');
    }
  } catch (error) {
    console.error('Error deleting existing page rules:', error);
  }
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
    const requiredEnvVars = {
      CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
      CLOUDFLARE_ZONE_ID: process.env.CLOUDFLARE_ZONE_ID,
      AIRTABLE_API_KEY: process.env.AIRTABLE_API_KEY,
      AIRTABLE_BASE_ID: process.env.AIRTABLE_BASE_ID,
      NETLIFY_SITE_ID: process.env.NETLIFY_SITE_ID,
      NETLIFY_ACCESS_TOKEN: process.env.NETLIFY_ACCESS_TOKEN
    };

    for (const [key, value] of Object.entries(requiredEnvVars)) {
      if (!value) {
        throw new Error(`${key} is not set`);
      }
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

        console.log(`Processing DNS record for ${subdomain}.${DOMAIN}`);

        // Check if DNS record already exists
        const existingRecord = await getDnsRecord(process.env.CLOUDFLARE_ZONE_ID, subdomain);
        
        let dnsResult;
        if (existingRecord) {
          console.log('Updating existing DNS record');
          // Update existing record
          dnsResult = await cfApiCall(
            `/zones/${process.env.CLOUDFLARE_ZONE_ID}/dns_records/${existingRecord.id}`,
            'PUT',
            {
              type: 'CNAME',
              name: subdomain,
              content: NETLIFY_SITE_URL,
              proxied: true,
              ttl: 1
            }
          );
        } else {
          console.log('Creating new DNS record');
          // Create new record
          dnsResult = await cfApiCall(
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
        }

        console.log('DNS record processed:', dnsResult);

        // Delete any existing page rules for this subdomain
        await deleteExistingPageRules(process.env.CLOUDFLARE_ZONE_ID, subdomain);

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
                  value: `*${subdomain}.${DOMAIN}/*`
                }
              }
            ],
            actions: [
              {
                id: 'cache_level',
                value: 'cache_everything'
              },
              {
                id: 'edge_cache_ttl',
                value: 2629746
              }
            ],
            status: 'active',
            priority: 1
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
        stack: error.stack,
        env: {
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
