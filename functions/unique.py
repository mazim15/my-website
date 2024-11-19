import os
import pandas as pd
from pathlib import Path

def clean_data(df):
    """Clean and standardize data in the DataFrame"""
    # Remove any leading/trailing whitespace
    for column in df.columns:
        if df[column].dtype == 'object':
            df[column] = df[column].str.strip()
    return df

def process_csv_files():
    # Define expected columns for each file type
    business_columns = ['subdomain', 'business_name', 'address', 'phone', 'maps_url']
    other_columns = ['subdomain', 'business_name', 'address', 'phone', 'Website', 'maps_url']
    
    # Files to ignore
    ignore_files = {'businesses.csv', 'inactive.csv'}
    
    # Get all CSV files in current directory
    csv_files = [f for f in os.listdir() 
                 if f.endswith('.csv') and f not in ignore_files]
    
    if not csv_files:
        print("No CSV files found to process")
        return
    
    # Read inactive records
    try:
        inactive_df = pd.read_csv('inactive.csv')
        inactive_df = clean_data(inactive_df)
        print(f"Loaded {len(inactive_df)} inactive records")
        
        # Verify inactive.csv structure
        if not all(col in inactive_df.columns for col in business_columns):
            print("Error: inactive.csv doesn't have the expected columns")
            return
    except FileNotFoundError:
        print("inactive.csv not found. Creating empty DataFrame")
        inactive_df = pd.DataFrame(columns=business_columns)
    
    # Read existing businesses if file exists
    try:
        businesses_df = pd.read_csv('businesses.csv')
        businesses_df = clean_data(businesses_df)
        print(f"Loaded {len(businesses_df)} existing business records")
        
        # Verify businesses.csv structure
        if not all(col in businesses_df.columns for col in business_columns):
            print("Error: businesses.csv doesn't have the expected columns")
            return
    except FileNotFoundError:
        print("businesses.csv not found. Will create new file")
        businesses_df = pd.DataFrame(columns=business_columns)
    
    # Process each CSV file
    new_records = []
    for file in csv_files:
        try:
            current_df = pd.read_csv(file)
            current_df = clean_data(current_df)
            print(f"Processing {file} with {len(current_df)} records")
            
            # Verify file structure
            if not all(col in current_df.columns for col in other_columns):
                print(f"Warning: {file} doesn't have all expected columns. Skipping...")
                continue
            
            # Keep only the columns we need for businesses.csv
            current_df = current_df[business_columns]
            
            # Filter out records that exist in inactive.csv
            if not inactive_df.empty:
                # Match based on subdomain
                inactive_subdomains = set(inactive_df['subdomain'].str.lower())
                current_df = current_df[~current_df['subdomain'].str.lower().isin(inactive_subdomains)]
                print(f"Found {len(current_df)} records not in inactive.csv")
            
            # Add to new records list
            new_records.append(current_df)
            
        except Exception as e:
            print(f"Error processing {file}: {str(e)}")
    
    if new_records:
        # Combine all new records
        combined_new = pd.concat(new_records, ignore_index=True)
        print(f"Total new records found: {len(combined_new)}")
        
        # Remove duplicates based on subdomain
        combined_new = combined_new.drop_duplicates(subset=['subdomain'], keep='first')
        print(f"Records after removing duplicates: {len(combined_new)}")
        
        # Remove records that already exist in businesses.csv based on subdomain
        if not businesses_df.empty:
            existing_subdomains = set(businesses_df['subdomain'].str.lower())
            combined_new = combined_new[~combined_new['subdomain'].str.lower().isin(existing_subdomains)]
        
        # Append to businesses.csv
        if not combined_new.empty:
            combined_new.to_csv('businesses.csv', 
                              mode='a', 
                              header=not Path('businesses.csv').exists(),
                              index=False)
            print(f"Added {len(combined_new)} new records to businesses.csv")
        else:
            print("No new unique records to add")
    else:
        print("No new records found to process")

if __name__ == "__main__":
    process_csv_files()