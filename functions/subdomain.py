import csv
import os
import re

BASE_DOMAIN = "gowso.online"

def make_url_friendly(name):
    """
    Converts a string into a URL-friendly format.
    Replaces spaces and special characters with hyphens and ensures lowercase.
    """
    # Remove special characters except hyphens and alphanumerics
    name = re.sub(r'[^a-zA-Z0-9\s-]', '', name)
    # Replace spaces and multiple hyphens with a single hyphen
    name = re.sub(r'\s+', '-', name)
    # Convert to lowercase
    return name.lower()

def process_csv(file_path):
    """
    Reads businesses.csv, processes business_name to create a subdomain, 
    and updates the CSV with a new subdomain column.
    """
    updated_rows = []
    with open(file_path, mode="r") as file:
        reader = csv.DictReader(file)
        fieldnames = reader.fieldnames + ["subdomain"] if "subdomain" not in reader.fieldnames else reader.fieldnames
        
        for row in reader:
            if "subdomain" in row and row["subdomain"]:
                updated_rows.append(row)
                continue
            # Generate subdomain
            business_name = row["business_name"]
            subdomain = f"{make_url_friendly(business_name)}.{BASE_DOMAIN}"
            row["subdomain"] = subdomain
            updated_rows.append(row)

    # Write back the updated CSV
    with open(file_path, mode="w", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(updated_rows)

if __name__ == "__main__":
    CSV_FILE = "businesses.csv"
    if os.path.exists(CSV_FILE):
        process_csv(CSV_FILE)
        print("CSV file updated with subdomain information.")
    else:
        print(f"CSV file '{CSV_FILE}' not found.")
