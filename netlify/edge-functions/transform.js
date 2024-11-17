// netlify/edge-functions/transform.js
import { Context } from '@netlify/edge-functions';

export default async (request, context) => {
  try {
    // Get subdomain from request
    const url = new URL(request.url);
    const host = request.headers.get('host');
    const subdomain = host.split('.')[0];

    // Fetch the original response
    const response = await context.next();
    const page = await response.text();

    // Fetch business data from function
    const businessResponse = await fetch(`${url.origin}/.netlify/functions/handleSubdomain`, {
      headers: {
        'host': host
      }
    });
    const business = await businessResponse.json();

    if (!business || business.error) {
      return new Response('Business not found', { status: 404 });
    }

    // Replace all variables in the HTML
    let newPage = page;
    newPage = newPage.replace(/{{business_name}}/g, business.business_name);
    newPage = newPage.replace(/{{phone}}/g, business.phone);
    newPage = newPage.replace(/{{address}}/g, business.address);
    newPage = newPage.replace(/{{maps_url}}/g, business.maps_url);

    // Return the transformed page
    return new Response(newPage, response);
  } catch (error) {
    console.error('Transform error:', error);
    return new Response('Error processing request', { status: 500 });
  }
}