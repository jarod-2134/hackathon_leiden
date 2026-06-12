import requests

def extract_github_content(url: str) -> str:
    """
    Extracts text content from a GitHub file URL.
    Converts blob URLs to raw.githubusercontent.com.
    """
    if "github.com" in url and "/blob/" in url:
        # Convert to raw URL
        raw_url = url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/")
    elif "raw.githubusercontent.com" in url:
        raw_url = url
    else:
        # If it's a repository or generic page, we can fallback to scraping or standard API.
        # For this hackathon scope, we try to fetch raw content directly or fallback.
        raw_url = url

    try:
        response = requests.get(raw_url, timeout=10)
        response.raise_for_status()
        return response.text
    except Exception as e:
        raise ValueError(f"Failed to fetch GitHub content from {raw_url}: {str(e)}")
