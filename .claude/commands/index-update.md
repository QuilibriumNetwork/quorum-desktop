Update the .readme/INDEX.md file by:

1. Scanning the entire .readme directory for any changes (new files, deleted files, moved files)
2. Adding any missing `[← Back to INDEX](../INDEX.md)` links below the title of markdown files AND at the end of the file
3. Organizing files into proper categories:
   - Documentation (docs/)
   - Bug Reports (bugs/) - separate SOLVED and Active
   - Tasks (tasks/) - separate done/, ongoing/, and todo/
4. Extracting titles from files for descriptions
5. Maintaining the same structure and format as the current INDEX.md
6. Updating the "Last Updated" date

Use Python to:

- Walk through the .claude directory
- Read each markdown file to extract its title
- Calculate relative paths for back links
- Generate the new INDEX.md content
- Add missing back links to files

Do not include Keywords or a Quick Search Guide section.
