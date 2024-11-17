const Airtable = require('airtable');

// Utility function to sanitize input
const sanitizeInput = (input) => {
    if (!input) return '';
    return input.toString().toLowerCase().replace(/[^a-z0-9-]/g, '');
};

// Utility function to validate fields exist
const validateFields = (record) => {
    const requiredFields = ['business_name', 'address', 'phone', 'maps_url'];
    const missingFields = requiredFields.filter(field => !record.fields[field]);
    return {
        isValid: missingFields.length === 0,
        missingFields
    };
};

exports.handler = async (event, context) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET'
    };

    // Log the incoming request
    console.log('Incoming request parameters:', event.queryStringParameters);

    try {
        // Get and validate query parameters
        let { business, subdomain } = event.queryStringParameters || {};

        // Sanitize inputs
        business = sanitizeInput(business);
        subdomain = sanitizeInput(subdomain);

        // Check if we have any valid parameters
        if (!business && !subdomain) {
            console.log('No valid business or subdomain parameter provided');
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Business or subdomain parameter is required',
                    timestamp: new Date().toISOString()
                })
            };
        }

        // Initialize Airtable
        const base = new Airtable({
            apiKey: process.env.AIRTABLE_API_KEY
        }).base(process.env.AIRTABLE_BASE_ID);

        // Build the filter formula
        // This will match against business_name and plumbing_name (if it exists)
        const searchTerm = business || subdomain;
        const filterFormula = `OR(
            LOWER({business_name}) = '${searchTerm}',
            LOWER({plumbing_name}) = '${searchTerm}'
        )`;

        console.log('Using filter formula:', filterFormula);

        // Query Airtable
        const records = await base('Businesses')
            .select({
                filterByFormula: filterFormula,
                maxRecords: 1
            })
            .firstPage();

        console.log(`Found ${records.length} matching records`);

        // Check if we found any records
        if (!records || records.length === 0) {
            console.log('No matching business found for:', searchTerm);
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    error: 'Business not found',
                    queriedValue: searchTerm,
                    timestamp: new Date().toISOString()
                })
            };
        }

        // Get the first matching record
        const record = records[0];

        // Validate required fields
        const { isValid, missingFields } = validateFields(record);
        if (!isValid) {
            console.log('Missing required fields:', missingFields);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: 'Incomplete business data',
                    missingFields,
                    timestamp: new Date().toISOString()
                })
            };
        }

        // Extract the fields we want to return
        const data = {
            business_name: record.fields.business_name,
            address: record.fields.address,
            phone: record.fields.phone,
            maps_url: record.fields.maps_url,
            // Include any optional fields if they exist
            email: record.fields.email || '',
            description: record.fields.description || '',
            hours: record.fields.hours || '',
            services: record.fields.services || [],
            // Add any additional fields you need
        };

        console.log('Returning data for business:', data.business_name);

        // Return the successful response
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                data,
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        // Log the full error for debugging
        console.error('Error processing request:', error);

        // Determine if it's an Airtable specific error
        const isAirtableError = error.error && error.error.type;

        // Return an appropriate error response
        return {
            statusCode: isAirtableError ? 503 : 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to fetch business data',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
                type: isAirtableError ? error.error.type : 'GeneralError',
                timestamp: new Date().toISOString()
            })
        };
    }
};