const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// Utility function to sanitize input
const sanitizeInput = (input) => {
    if (!input) return '';
    return input.toString().toLowerCase().replace(/[^a-z0-9-]/g, '');
};

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET',
        'Content-Type': 'application/json'
    };

    try {
        // Get subdomain parameter
        let { business } = event.queryStringParameters || {};
        business = sanitizeInput(business);

        if (!business) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Business identifier required' })
            };
        }

        // Read and parse CSV file
        const csvPath = path.join(__dirname, 'businesses.csv');
        const fileContent = fs.readFileSync(csvPath, 'utf-8');
        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });

        // Find matching business
        const matchingBusiness = records.find(record => {
            const csvSubdomain = record.subdomain.split('.')[0];
            return sanitizeInput(csvSubdomain) === business;
        });

        if (!matchingBusiness) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    error: 'Business not found',
                    queriedValue: business
                })
            };
        }

        // Return only the needed fields
        const responseData = {
            business_name: matchingBusiness.business_name,
            phone: matchingBusiness.phone,
            address: matchingBusiness.address,
            maps_url: matchingBusiness.maps_url
        };

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(responseData)
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to fetch business data'
            })
        };
    }
};
