# HVAC Troubleshooter Pro v7

## How to Publish on GitHub Pages

1. **Download & Extract**
   - Download the provided `hvac_troubleshooter_pro_v7_full.zip` file.
   - Extract all contents to a folder on your computer.

2. **Upload to GitHub**
   - Go to your GitHub repository for the HVAC Troubleshooter.
   - Click **Add file → Upload files**.
   - Drag and drop **all extracted files and folders** into the upload area.
     - Make sure the `pt/` folder stays intact in the root of the repository.
   - Commit the changes.

3. **Verify Folder Structure**
   Your repository should contain:
   ```
   index.html
   manifest.json
   service-worker.js
   icon-192.png
   icon-512.png
   pt/
     R410A-PT.json
     R32-PT.json
     R454B-PT.json
     R22-PT.json
   ```

4. **Access the App**
   - Visit: `https://<your-username>.github.io/<your-repo-name>/`
   - If you don't see the update, clear your browser cache or uninstall/reinstall the PWA.

## Notes
- The `pt/` folder contains pressure–temperature data files for multiple refrigerants. Do not rename or move it.
- To add more refrigerants, place their `.json` PT files into the `pt/` folder.
- Always keep the file structure exactly as above to ensure the app works correctly.
