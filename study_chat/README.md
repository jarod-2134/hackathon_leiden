# SokraText

Welcome to SokraText! This document provides instructions on how to start the server, handle installations, and configure your API keys.

## Starting the Server
To boot up the application, simply run the batch script provided in the project root:

```cmd
.\run.bat
```

This script will automatically activate the Python virtual environment and start the Uvicorn server. Once running, you can access the application at `http://127.0.0.1:8000/static/index.html`.

## Installation Script
<!-- Leave empty for now as requested -->


## Installations That Might Happen
When you run the project for the first time, or if new dependencies are added, the following components might be installed automatically or manually:
- **Python Virtual Environment**: A `venv` folder is created to sandbox all dependencies.
- **FastAPI & Uvicorn**: The core backend web framework and server.
- **PyTorch & Transformers**: Used for the local AI summarization pipeline. Note: `torch` is a massive dependency and may take a few minutes to download and extract.
- **Playwright (Chromium)**: Used for robust web scraping. It installs Chromium browser binaries locally.

## API Key Configuration
SokraText requires an API key to communicate with the AI models. By default, this uses the Grok API.

**Where to configure it:**
1. In the root of the project, duplicate the `.env.example` file and rename it to `.env`.
2. Open the newly created `.env` file and replace the placeholder with your actual API key:
   ```env
   GROK_API_KEY=your-actual-api-key-here
   ```
The application will automatically detect the `.env` file and securely load your key when starting the server.
