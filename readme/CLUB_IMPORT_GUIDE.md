# Club Import Guide

## How to Import Clubs

The application has been set up to make importing tennis clubs easy and repeatable.

### Import Process

1. **Update the club list**:
   - Edit the file: `code/club/list.json`
   - Add or update club entries as needed
   - The file structure should maintain the format:
     ```json
     {
       "club_markers": [
         {
           "nom": "Club Name",
           "clubId": "unique_id",
           "ville": "City",
           "terrainPratiqueLibelle": "5 terrains dont 3 couverts",
           "pratiques": ["TENNIS"],
           "lat": 48.1234,
           "lng": -0.1234
         }
       ]
     }
     ```

2. **Copy to public directory**:
   ```bash
   cp code/club/list.json public/code/club/list.json
   ```

3. **Import via Settings Page**:
   - Log in to the application
   - Navigate to Settings
   - Scroll to the "Data Import" section
   - Click "Import Clubs from JSON"
   - Wait for the import to complete

### Features

- **Duplicate Handling**: Clubs are identified by `clubId`. If a club with the same ID already exists, it will be updated with new data.
- **Court Information Parsing**: The import automatically extracts:
  - Total tennis courts
  - Indoor courts
  - Padel courts
  - Pickleball courts

  From the `terrainPratiqueLibelle` field using pattern matching.

- **Batch Processing**: Imports are processed in batches of 100 clubs for optimal performance.

### Parsed Court Examples

The import function intelligently parses court information from text:

- "5 terrains dont 3 couverts" → 5 total courts, 3 indoor courts
- "Tennis : 6 terrains, Pickleball : 3" → 6 tennis courts, 3 pickleball courts
- "2 terrains dont 2 couverts" → 2 total courts, 2 indoor courts

### After Import

The imported clubs will be immediately visible on the Clubs page with all filters working:
- Search by club name or city
- Filter by minimum courts
- Filter for indoor courts only
- Filter by surface type
- Distance filtering

## Troubleshooting

### How to Check Error Logs

If the import fails, follow these steps to see detailed error information:

1. **Open Browser Console**:
   - Press `F12` (Windows/Linux) or `Cmd+Option+I` (Mac)
   - Click on the "Console" tab

2. **Run the Import**:
   - Click the "Import Clubs from JSON" button in Settings
   - Watch the console for detailed log messages

3. **Look for Error Messages**:
   The console will show:
   - Batch processing progress (e.g., "Processing batch 1/23")
   - Success messages (e.g., "✓ Batch 1 imported successfully")
   - Detailed error messages with error codes and details
   - The first club data from failed batches
   - A summary of all errors at the end

### Common Issues

1. **File Not Found (404)**:
   - Make sure you copied the file to `public/code/club/list.json`
   - Check the file path is correct

2. **Database Permission Errors**:
   - Ensure you're logged in
   - Check that the clubs table exists in Supabase
   - Verify RLS policies allow inserts

3. **Data Validation Errors**:
   - Check that all required fields are present (nom, clubId, ville, etc.)
   - Ensure lat/lng are valid numbers
   - Verify pratiques is an array

4. **Duplicate Key Errors**:
   - This should not happen as the import uses upsert
   - If it does, check for duplicate clubId values in your JSON

### Checking Database

To verify clubs were imported, run this SQL in Supabase:

```sql
SELECT COUNT(*) FROM clubs;
SELECT * FROM clubs ORDER BY created_at DESC LIMIT 10;
```
