import csv
from twilio.rest import Client
import json

# Twilio credentials
account_sid = 'ACa4909257d33a640b4981ab3152edb279'
auth_token = 'c03c42444d8e9b7f6dba4296a280ad58'
client = Client(account_sid, auth_token)

def fetch_line_type(number):
    try:
        # Fetch details with line type intelligence
        phone_number = client.lookups.v2.phone_numbers(number).fetch(
            fields="line_type_intelligence"
        )
        return {
            "Number": number,
            "Line Type Intelligence": phone_number.line_type_intelligence,
        }
    except Exception as e:
        return {
            "Number": number,
            "Error": str(e),
        }

def is_active_line_type(line_type):
    # Check if the line type is one we want to keep active
    if isinstance(line_type, dict):
        type_value = line_type.get("type", "").lower()
        active_types = ["mobile", "nonfixedvoip", "fixedvoip"]
        return type_value in active_types
    return False

def get_line_type_details(result):
    base_details = {
        "line_type": "unknown",
        "carrier_name": "unknown",
        "mobile_country_code": "",
        "mobile_network_code": "",
        "error_message": ""  # Include error_message field by default
    }
    
    if "Line Type Intelligence" in result and isinstance(result["Line Type Intelligence"], dict):
        line_type = result["Line Type Intelligence"]
        base_details.update({
            "line_type": line_type.get("type", "unknown"),
            "carrier_name": line_type.get("carrier_name", "unknown"),
            "mobile_country_code": line_type.get("mobile_country_code", ""),
            "mobile_network_code": line_type.get("mobile_network_code", "")
        })
    elif "Error" in result:
        base_details.update({
            "line_type": "error",
            "carrier_name": "error",
            "error_message": result["Error"]
        })
    
    return base_details

def process_businesses():
    # Read the input CSV file
    businesses = []
    try:
        with open('businesses.csv', 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            businesses = list(reader)
    except FileNotFoundError:
        print("Error: businesses.csv file not found")
        return
    
    # Prepare output files
    active_businesses = []
    inactive_businesses = []
    detailed_results = []
    results = []
    
    # Process each business
    for business in businesses:
        phone = business['phone']
        result = fetch_line_type(phone)
        results.append(result)
        
        # Get line type details
        line_type_details = get_line_type_details(result)
        
        # Create detailed result record
        detailed_record = {
            **business,  # Include all original business fields
            **line_type_details  # Add line type details
        }
        detailed_results.append(detailed_record)
        
        # Check if the number is of an active type
        is_active = False
        if "Line Type Intelligence" in result:
            line_type = result["Line Type Intelligence"]
            is_active = is_active_line_type(line_type)
        
        # Sort business based on line type
        if is_active:
            active_businesses.append(business)
            print(f"Active number found ({line_type_details['line_type']}): {phone}")
        else:
            inactive_businesses.append(business)
            print(f"Inactive number found ({line_type_details['line_type']}): {phone}")
        
        # Print detailed results
        print(f"Details for {phone}:")
        print(json.dumps(result, indent=2))
        print("-" * 50)
    
    # Save active businesses to original CSV
    with open('businesses.csv', 'w', newline='', encoding='utf-8') as file:
        writer = csv.DictWriter(file, fieldnames=businesses[0].keys())
        writer.writeheader()
        writer.writerows(active_businesses)
    
    # Save inactive businesses to inactive.csv
    with open('inactive.csv', 'w', newline='', encoding='utf-8') as file:
        writer = csv.DictWriter(file, fieldnames=businesses[0].keys())
        writer.writeheader()
        writer.writerows(inactive_businesses)
    
    # Define all possible fields for detailed results
    detailed_fieldnames = list(businesses[0].keys()) + [
        "line_type",
        "carrier_name",
        "mobile_country_code",
        "mobile_network_code",
        "error_message"
    ]
    
    # Save detailed results to detailed_results.csv
    with open('detailed_results.csv', 'w', newline='', encoding='utf-8') as file:
        writer = csv.DictWriter(file, fieldnames=detailed_fieldnames)
        writer.writeheader()
        writer.writerows(detailed_results)
    
    # Save raw results to JSON file
    with open("line_type_results.json", "w") as file:
        json.dump(results, file, indent=4)
    
    print("\nSummary:")
    print(f"Total businesses processed: {len(businesses)}")
    print(f"Active businesses (mobile/nonFixedVoip/fixedVoip): {len(active_businesses)}")
    print(f"Inactive businesses (other types): {len(inactive_businesses)}")
    print("Results saved to:")
    print("- businesses.csv (active numbers)")
    print("- inactive.csv (inactive numbers)")
    print("- detailed_results.csv (all businesses with line type details)")
    print("- line_type_results.json (raw API results)")

if __name__ == "__main__":
    process_businesses()