// functions/handleSubdomain.js
const fs = require('fs');
const csv = require('csv-parse/sync');
const path = require('path');

exports.handler = async (event, context) => {
  try {
    // Get the host from the headers
    const host = event.headers.host;
    const subdomain = host.split('.')[0];

    // Read and parse the CSV file
    const csvPath = path.join(__dirname, 'businesses.csv');
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = csv.parse(fileContent, {
      columns: true,
      skip_empty_lines: true
    });

    // Find the matching business
    const business = records.find(record => record.subdomain === subdomain);

    if (!business) {
      return {
        statusCode: 404,
        body: JSON.stringify({ 
          error: 'Business not found',
          message: `No business found for subdomain: ${subdomain}`
        })
      };
    }

    // Return just the business data
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      },
      body: JSON.stringify(business)
    };
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};