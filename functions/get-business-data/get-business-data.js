const Airtable = require('airtable');

exports.handler = async (event) => {
    // Get the business parameter or extract from subdomain
    let { business, subdomain } = event.queryStringParameters;
    
    // If neither business nor subdomain is provided
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

        // Build the filter formula to check both business_name and subdomain
        let filterFormula;
        if (business) {
            filterFormula = `{business_name}='${business}'`;
        } else if (subdomain) {
            filterFormula = `{subdomain}='${subdomain}'`;
        }

        const records = await base('Businesses')
            .select({
                filterByFormula: filterFormula
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

        // Add CORS headers
        const headers = {
            'Access-Control-Allow-Origin': '*', // Be more specific in production
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET'
        };

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error('Error:', error); // Add logging for debugging

        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to fetch business data',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            })
        };
    }
};