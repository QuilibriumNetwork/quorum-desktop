Update the .readme/INDEX.md file by:

1. Scanning the entire .readme directory for any changes (new files, deleted files, moved files)
2. Adding any missing `[← Back to INDEX](/.readme/INDEX.md)` links below the title of markdown files AND at the end of the file. Keep existing "Back to index" if they are pointing to other indexes. 
3. Extracting titles from files for descriptions
4. Maintaining the same structure and format as the current INDEX.md
5. If files are in subfolders, e.g., docs/features, always group them according to tjhe subfolder they are in
6. Updating the "Last Updated" date

Use Python to:

- Walk through the .claude directory
- Read each markdown file to extract its title
- Calculate relative paths for back links
- Generate the new INDEX.md content
- Add missing back links to files

Do not include Keywords or a Quick Search Guide section.
