// functions/getBusinessData.js

const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

exports.handler = async function(event, context) {
  const subdomain = event.queryStringParameters.subdomain;

  if (!subdomain) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Subdomain parameter is required' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Add this line
      },
    };
  }

  try {
    // Adjust the path as needed
    const csvFilePath = path.join(__dirname, 'businesses.csv');
    const file = fs.readFileSync(csvFilePath, 'utf8');

    // Parse the CSV data
    const parsedData = Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
    });

    // Find the business data for the subdomain
    const business = parsedData.data.find(
      (business) => business.subdomain === subdomain
    );

    if (business) {
      return {
        statusCode: 200,
        body: JSON.stringify(business),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*', // Add this line
        },
      };
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Business not found' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*', // Add this line
        },
      };
    }
  } catch (error) {
    console.error('Error in getBusinessData function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Add this line
      },
    };
  }
};
