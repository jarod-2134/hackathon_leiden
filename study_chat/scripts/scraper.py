import os
import re
import requests
from bs4 import BeautifulSoup

def scrape_web_files(TARGET_URL, OUTPUT_DIR, SUBJECT="General"):

    if not os.path.exists(f"files/{SUBJECT}/books/{OUTPUT_DIR}"):
        os.makedirs(f"files/{SUBJECT}/books/{OUTPUT_DIR}")

    def clean_filename(filename):
        return re.sub(r'[\\/*?:"<>|]', "", filename)

    def universal_crawler():
        print(f"Connecting to: {TARGET_URL}...")
        try:
            response = requests.get(TARGET_URL)
            response.raise_for_status()
        except requests.exceptions.RequestException as e:
            print(f"Connection failed: {e}")
            return

        soup = BeautifulSoup(response.text, 'html.parser')
        all_links = soup.find_all('a', href=True)
        
        discovered_items = []
        seen_urls = set()
        
        # Global ignore filters for typical textbook navigation junk
        exclude_keywords = {'index.html', 'references.html', 'notation.html', 'copyright.html', 'preface.html', 'slides/', 'pptx'}

        for link in all_links:
            href = link['href'].strip()
            title = link.get_text(strip=True)
            
            clean_href = href.split('#')[0] # Remove internal page anchors
            
            if any(keyword in clean_href.lower() for keyword in exclude_keywords):
                continue

            # Check if it's a valid chapter link (.html or .pdf)
            if clean_href.endswith('.html') or clean_href.endswith('.pdf'):
                if clean_href.startswith('http'):
                    full_url = clean_href
                else:
                    # Resolve relative URL paths cleanly
                    full_url = TARGET_URL + clean_href if TARGET_URL.endswith('/') else f"{TARGET_URL}/{clean_href}"
                
                if full_url not in seen_urls:
                    seen_urls.add(full_url)
                    # Fallback for empty titles
                    display_title = title if len(title) > 2 else clean_href.split('/')[-1].replace('.html', '').replace('.pdf', '')
                    discovered_items.append({'title': display_title, 'url': full_url, 'is_pdf': full_url.endswith('.pdf')})

        print(f"Discovered {len(discovered_items)} distinct chapters/links to process.\n")

        # We only start the heavy browser if we actually encounter HTML pages
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = None
            page = None

            for index, item in enumerate(discovered_items, start=1):
                title = item['title']
                url = item['url']
                is_pdf = item['is_pdf']
                
                safe_title = clean_filename(title).replace(" ", "_").replace(":", "")
                filename = f"{index:02d}_{safe_title}.pdf"
                filepath = os.path.join(f"files/{SUBJECT}/books/{OUTPUT_DIR}", filename)
                
                # ROUTE 1: The link is already a PDF file (Stanford Style)
                if is_pdf:
                    print(f"[{index}/{len(discovered_items)}] Direct Downloading PDF: {title}")
                    try:
                        with requests.get(url, stream=True) as r:
                            r.raise_for_status()
                            with open(filepath, 'wb') as f:
                                for chunk in r.iter_content(chunk_size=8192):
                                    f.write(chunk)
                        print(f" -> Saved raw PDF.")
                    except Exception as e:
                        print(f" -> [ERROR] Download failed: {e}")
                
                # ROUTE 2: The link is a Web Page that needs rendering (MIT Style)
                else:
                    print(f"[{index}/{len(discovered_items)}] Rendering Web Page to PDF: {title}")
                    try:
                        if not browser:
                            browser = p.chromium.launch(headless=True)
                            context = browser.new_context()
                            page = context.new_page()
                        
                        page.goto(url, wait_until="networkidle")
                        page.wait_for_timeout(2000) # Wait for math variables/LaTeX layout
                        page.emulate_media(media="print")
                        page.pdf(
                            path=filepath,
                            format="Letter",
                            margin={"top": "0.75in", "right": "0.75in", "bottom": "0.75in", "left": "0.75in"},
                            print_background=True
                        )
                        print(f" -> Print execution successful.")
                    except Exception as e:
                        print(f" -> [ERROR] Rendering failed: {e}")

            if browser:
                browser.close()

        print(f"\nTask complete! Output folder: '{OUTPUT_DIR}'")

    universal_crawler()
