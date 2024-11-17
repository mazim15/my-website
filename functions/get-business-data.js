// Function to parse CSV and get business data based on subdomain
async function getBusinessData() {
    // Get current subdomain
    const subdomain = window.location.hostname.split('.')[0];

    try {
        // Fetch the CSV file
        const response = await fetch('/functions/businesses.csv');
        const csvText = await response.text();

        // Parse CSV manually 
        const rows = csvText.trim().split('\n');
        const headers = rows[0].split(',');
        
        // Find the matching business for the subdomain
        for (let i = 1; i < rows.length; i++) {
            const values = rows[i].split(',');
            const rowData = {};
            headers.forEach((header, index) => {
                rowData[header.trim()] = values[index].trim();
            });

            if (rowData.subdomain.toLowerCase() === subdomain.toLowerCase()) {
                return rowData;
            }
        }

        // If no matching subdomain found
        return null;
    } catch (error) {
        console.error('Error fetching business data:', error);
        return null;
    }
}

// Function to display business data on the page
async function displayBusinessData() {
    const businessData = await getBusinessData();
    
    if (businessData) {
        // Update page elements with business data
        document.getElementById('business-name').textContent = businessData.business_name || 'Business Name';
        document.getElementById('business-address').textContent = businessData.address || 'Address Not Available';
        document.getElementById('business-phone').textContent = businessData.phone || 'Phone Not Available';
        
        // Update Google Maps iframe if available
        const mapFrame = document.getElementById('google-maps-frame');
        if (businessData.maps_url) {
            mapFrame.src = businessData.maps_url;
            mapFrame.style.display = 'block';
        } else {
            mapFrame.style.display = 'none';
        }
    } else {
        // Handle case where no business is found
        document.getElementById('business-info').innerHTML = 
            '<p>Business information not found for this subdomain.</p>';
    }
}

// Run on page load
document.addEventListener('DOMContentLoaded', displayBusinessData);
