#!/bin/bash

# Script to combine all files in each folder into a single markdown file
# Usage: ./combine_folder_files.sh [target_directory]

# set -e  # Disabled to allow script to continue even if individual folders have issues

# Default target directory is docs, but allow override
TARGET_DIR="${1:-docs}"
BASE_DIR="$(pwd)"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting to combine files in folders...${NC}"
echo -e "${YELLOW}Target directory: $TARGET_DIR${NC}"
echo ""

# Check if target directory exists
if [ ! -d "$TARGET_DIR" ]; then
    echo -e "${YELLOW}Error: Directory '$TARGET_DIR' does not exist.${NC}"
    exit 1
fi

# Function to combine files in a folder
combine_files_in_folder() {
    local folder_path="$1"
    local folder_name=$(basename "$folder_path")
    local output_file="$folder_path/${folder_name}-combined.md"
    
    echo -e "${GREEN}Processing folder: $folder_name${NC}"
    
    # Create or clear the output file
    > "$output_file"
    
    # Add header
    echo "# Combined Files from $folder_name" >> "$output_file"
    echo "" >> "$output_file"
    echo "*Generated on: $(date)*" >> "$output_file"
    echo "" >> "$output_file"
    echo "---" >> "$output_file"
    echo "" >> "$output_file"
    
    # Find all files in the folder (excluding the combined file itself)
    local file_count=0
    
    # Loop through all files in the folder
    for file in "$folder_path"/*; do
        # Skip directories and the combined file itself
        if [ -f "$file" ] && [ "$(basename "$file")" != "${folder_name}-combined.md" ] && [ "$(basename "$file")" != "COMBINED.md" ]; then
            local filename=$(basename "$file")
            local file_ext="${filename##*.}"
            
            echo "  Adding: $filename"
            
            # Add file separator
            echo "## File: $filename" >> "$output_file"
            echo "" >> "$output_file"
            echo "**Path:** \`$filename\`" >> "$output_file"
            echo "" >> "$output_file"
            
            # Add file content with proper formatting
            if [[ "$file_ext" == "md" || "$file_ext" == "markdown" ]]; then
                # For markdown files, include content directly
                echo "\`\`\`markdown" >> "$output_file"
                cat "$file" >> "$output_file"
                echo "" >> "$output_file"
                echo "\`\`\`" >> "$output_file"
            elif [[ "$file_ext" == "json" ]]; then
                # For JSON files
                echo "\`\`\`json" >> "$output_file"
                cat "$file" >> "$output_file"
                echo "" >> "$output_file"
                echo "\`\`\`" >> "$output_file"
            elif [[ "$file_ext" == "js" || "$file_ext" == "jsx" || "$file_ext" == "ts" || "$file_ext" == "tsx" ]]; then
                # For JavaScript/TypeScript files
                echo "\`\`\`$file_ext" >> "$output_file"
                cat "$file" >> "$output_file"
                echo "" >> "$output_file"
                echo "\`\`\`" >> "$output_file"
            elif [[ "$file_ext" == "py" ]]; then
                # For Python files
                echo "\`\`\`python" >> "$output_file"
                cat "$file" >> "$output_file"
                echo "" >> "$output_file"
                echo "\`\`\`" >> "$output_file"
            elif [[ "$file_ext" == "yaml" || "$file_ext" == "yml" ]]; then
                # For YAML files
                echo "\`\`\`yaml" >> "$output_file"
                cat "$file" >> "$output_file"
                echo "" >> "$output_file"
                echo "\`\`\`" >> "$output_file"
            elif [[ "$file_ext" == "sh" ]]; then
                # For shell scripts
                echo "\`\`\`bash" >> "$output_file"
                cat "$file" >> "$output_file"
                echo "" >> "$output_file"
                echo "\`\`\`" >> "$output_file"
            elif [[ "$file_ext" == "sql" ]]; then
                # For SQL files
                echo "\`\`\`sql" >> "$output_file"
                cat "$file" >> "$output_file"
                echo "" >> "$output_file"
                echo "\`\`\`" >> "$output_file"
            elif [[ "$file_ext" == "dockerfile" || "$filename" == "Dockerfile" ]]; then
                # For Dockerfiles
                echo "\`\`\`dockerfile" >> "$output_file"
                cat "$file" >> "$output_file"
                echo "" >> "$output_file"
                echo "\`\`\`" >> "$output_file"
            else
                # For other files, try to detect if they're text files
                if file "$file" | grep -q "text"; then
                    echo "\`\`\`text" >> "$output_file"
                    cat "$file" >> "$output_file"
                    echo "" >> "$output_file"
                    echo "\`\`\`" >> "$output_file"
                else
                    echo "*Binary file - content not displayed*" >> "$output_file"
                fi
            fi
            
            echo "" >> "$output_file"
            echo "---" >> "$output_file"
            echo "" >> "$output_file"
            
            ((file_count++))
        fi
    done
    
    if [ $file_count -eq 0 ]; then
        echo "  No files found in this folder"
        rm "$output_file"  # Remove empty combined file
    else
        echo "  Combined $file_count files into ${folder_name}-combined.md"
    fi
}

# Process each folder in the target directory
folder_count=0
for folder in "$TARGET_DIR"/*; do
    if [ -d "$folder" ]; then
        combine_files_in_folder "$folder"
        ((folder_count++))
    fi
done

echo ""
echo -e "${GREEN}Completed! Processed $folder_count folders.${NC}"
echo -e "${BLUE}Combined files have been saved as '[folder-name]-combined.md' in each respective folder.${NC}"
