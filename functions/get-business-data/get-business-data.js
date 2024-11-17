const Airtable = require('airtable');

exports.handler = async (event) => {
    const { business } = event.queryStringParameters;
    
    if (!business) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Business parameter is required' })
        };
    }

    try {
        const base = new Airtable({
            apiKey: process.env.AIRTABLE_API_KEY
        }).base(process.env.AIRTABLE_BASE_ID);

        const records = await base('Businesses')
            .select({
                filterByFormula: `{business_name}='${business}'`
            })
            .firstPage();

        if (!records || records.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Business not found' })
            };
        }

        const data = records[0].fields;

        return {
            statusCode: 200,
            body: JSON.stringify(data)
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch business data' })
        };
    }
};