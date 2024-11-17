const Airtable = require('airtable');

// Initialize Airtable
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID);

// Configuration constants
const NETLIFY_SITE_URL = 'plumbingservicesusa.netlify.app';
const DOMAIN = 'gowso.online';
const CF_API_BASE = 'https://api.cloudflare.com/client/v4';
const NETLIFY_API_BASE = 'https://api.netlify.com/api/v1';

// Helper function for Cloudflare API calls with enhanced error handling
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

  try {
    const response = await fetch(url, options);
    const result = await response.json();

    if (!result.success) {
      throw new Error(
        `Cloudflare API error: ${result.errors?.[0]?.message || 'Unknown error'}`
      );
    }

    return result.result;
  } catch (error) {
    console.error('Detailed Cloudflare API error:', {
      endpoint,
      method,
      error: error.message
    });
    throw new Error(`Cloudflare API error: ${error.message}`);
  }
}

// Helper function to check if DNS record exists with error handling
async function getDnsRecord(zoneId, name) {
  try {
    const records = await cfApiCall(
      `/zones/${zoneId}/dns_records?name=${name}.${DOMAIN}`
    );
    return records.length > 0 ? records[0] : null;
  } catch (error) {
    console.error('Error checking DNS record:', {
      zoneId,
      name,
      error: error.message
    });
    throw new Error(`Failed to check DNS record: ${error.message}`);
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
      await cfApiCall(
        `/zones/${zoneId}/pagerules/${rule.id}`,
        'DELETE'
      );
    }
    return subdomainRules.length;
  } catch (error) {
    console.error('Error deleting page rules:', {
      zoneId,
      subdomain,
      error: error.message
    });
    throw new Error(`Failed to delete page rules: ${error.message}`);
  }
}

// Helper function to set a Netlify environment variable with retry logic
async function setNetlifyEnvVar(siteId, key, value, retries = 3) {
  const url = `${NETLIFY_API_BASE}/sites/${siteId}/env/${key}`;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Check if variable exists
      const getResponse = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`
        }
      });

      const method = getResponse.status === 404 ? 'POST' : 'PUT';
      const endpoint = method === 'POST' 
        ? `${NETLIFY_API_BASE}/sites/${siteId}/env` 
        : url;

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key,
          values: [{
            value,
            context: "all"
          }]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt === retries) {
        console.error(`Final attempt failed for ${key}:`, error);
        throw new Error(`Failed to set Netlify variable after ${retries} attempts: ${error.message}`);
      }
      console.warn(`Attempt ${attempt} failed for ${key}, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// Helper function to validate and normalize business data
function validateBusinessData(record) {
  const businessName = record.get('business_name');
  
  if (!businessName || !businessName.trim()) {
    throw new Error(`Missing or invalid business name for record ${record.id}`);
  }

  return {
    name: businessName.trim(),
    address: (record.get('address') || '').trim(),
    phone: (record.get('phone') || '').trim(),
    maps: (record.get('maps_url') || '').trim(),
  };
}

// Helper function to create subdomain from business name
function createSubdomain(businessName) {
  return businessName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 63); // DNS label length limit
}

// Helper function to verify Netlify site
async function verifyNetlifySite(siteId) {
  const url = `${NETLIFY_API_BASE}/sites/${siteId}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`
    }
  });

  if (!response.ok) {
    throw new Error(`Invalid Netlify site ID: ${siteId}`);
  }

  return await response.json();
}

// Main handler function
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

    // Verify Netlify site before proceeding
    console.log('Verifying Netlify site...');
    await verifyNetlifySite(process.env.NETLIFY_SITE_ID);

    // Test Cloudflare API connection
    console.log('Testing Cloudflare API connection...');
    const zoneDetails = await cfApiCall(`/zones/${process.env.CLOUDFLARE_ZONE_ID}`);
    console.log('Cloudflare API connection successful:', zoneDetails.name);

    // Get records from Airtable
    console.log('Fetching records from Airtable...');
    const records = await base('Businesses').select({
      filterByFormula: '{subdomain_created} = 0'
    }).firstPage();

    if (!records || records.length === 0) {
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
    const errors = [];

    for (let record of records) {
      try {
        // Validate and get business data
        const businessData = validateBusinessData(record);
        const subdomain = createSubdomain(businessData.name);

        console.log(`Processing DNS record for ${subdomain}.${DOMAIN}`);

        // Check and update/create DNS record
        const existingRecord = await getDnsRecord(process.env.CLOUDFLARE_ZONE_ID, subdomain);
        
        const dnsData = {
          type: 'CNAME',
          name: subdomain,
          content: NETLIFY_SITE_URL,
          proxied: true,
          ttl: 1
        };

        let dnsResult;
        if (existingRecord) {
          console.log('Updating existing DNS record');
          dnsResult = await cfApiCall(
            `/zones/${process.env.CLOUDFLARE_ZONE_ID}/dns_records/${existingRecord.id}`,
            'PUT',
            dnsData
          );
        } else {
          console.log('Creating new DNS record');
          dnsResult = await cfApiCall(
            `/zones/${process.env.CLOUDFLARE_ZONE_ID}/dns_records`,
            'POST',
            dnsData
          );
        }

        // Delete existing page rules and create new one
        await deleteExistingPageRules(process.env.CLOUDFLARE_ZONE_ID, subdomain);
        
        const pageRuleResult = await cfApiCall(
          `/zones/${process.env.CLOUDFLARE_ZONE_ID}/pagerules`,
          'POST',
          {
            targets: [{
              target: 'url',
              constraint: {
                operator: 'matches',
                value: `*${subdomain}.${DOMAIN}/*`
              }
            }],
            actions: [{
              id: 'cache_level',
              value: 'cache_everything'
            }, {
              id: 'edge_cache_ttl',
              value: 2629746 // 1 month in seconds
            }],
            status: 'active',
            priority: 1
          }
        );

        // Set Netlify environment variables
        const envVars = {
          [`BUSINESS_NAME_${subdomain}`]: businessData.name,
          [`BUSINESS_ADDRESS_${subdomain}`]: businessData.address,
          [`BUSINESS_PHONE_${subdomain}`]: businessData.phone,
          [`BUSINESS_MAPS_${subdomain}`]: businessData.maps
        };

        for (const [key, value] of Object.entries(envVars)) {
          await setNetlifyEnvVar(process.env.NETLIFY_SITE_ID, key, value);
        }

        // Update Airtable record
        await base('Businesses').update(record.id, {
          'subdomain_created': true,
          'subdomain': `${subdomain}.${DOMAIN}`
        });

        results.push({
          business: businessData.name,
          subdomain: `${subdomain}.${DOMAIN}`,
          status: 'success',
          dns_id: dnsResult.id,
          page_rule_id: pageRuleResult.id
        });

      } catch (error) {
        console.error(`Error processing record ${record.id}:`, error);
        errors.push({
          record_id: record.id,
          business: record.get('business_name') || 'Unknown',
          error: error.message,
          status: 'failed'
        });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Processing complete',
        successful: results.length,
        failed: errors.length,
        results,
        errors
      })
    };

  } catch (error) {
    console.error('Fatal error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to process businesses',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        env_status: {
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