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
        headers: {
          'Content-Type': 'text/html'
        },
        body: '<h1>Business Not Found</h1><p>The requested business page does not exist.</p>'
      };
    }

    // Read the HTML template
    const templatePath = path.join(__dirname, '..', 'public', 'index.html');
    let htmlContent = fs.readFileSync(templatePath, 'utf-8');

    // Replace template variables
    htmlContent = htmlContent.replace(/{{business_name}}/g, business.business_name);
    htmlContent = htmlContent.replace(/{{phone}}/g, business.phone);
    htmlContent = htmlContent.replace(/{{address}}/g, business.address);
    htmlContent = htmlContent.replace(/{{maps_url}}/g, business.maps_url);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=300'
      },
      body: htmlContent
    };
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'text/html'
      },
      body: '<h1>Server Error</h1><p>Sorry, something went wrong.</p>'
    };
  }
};