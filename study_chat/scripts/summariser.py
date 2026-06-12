import os
import sys
from pypdf import PdfReader
from transformers import pipeline

def summariser():
    # Configuration
    INPUT_DIR = "files"  # Points to your /files folder
    OUTPUT_FILE = "summary/summary.md"

    # Make sure the output directory exists before writing to it
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

    # Global placeholder for the AI pipeline
    global summarizer
    summarizer = None

    def load_local_model():
        """Dynamically loads the fast, lightweight model inside the Python lifecycle."""
        global summarizer
        print("Loading fast, lightweight 270MB AI summarization model into memory...")
        
        # FIXED: Uses 'text-generation' to avoid task KeyErrors 
        # FIXED: Swapped to distilbart-cnn-6-6 for extreme speed on CPU architectures
        summarizer = pipeline(
            "text-generation", 
            model="./local_model", 
            device="cpu" 
        )
        print("Lightweight model successfully initialized!\n")

    def extract_text_from_pdf(filepath):
        """Extracts text from the first 4 pages to hit the hackathon 1.5-minute goal."""
        text = ""
        try:
            reader = PdfReader(filepath)
            # SPEED OPTIMIZATION: Only parse up to 4 pages (where core introduction/abstract sits)
            pages_to_read = min(len(reader.pages), 4)
            for i in range(pages_to_read):
                page_text = reader.pages[i].extract_text()
                if page_text:
                    text += page_text + "\n"
        except Exception as e:
            print(f"   [Error reading PDF {os.path.basename(filepath)}]: {e}")
        return text

    def run_summarize(text_content):
        """Processes the first text chunk instantly through the model pipeline."""
        # SPEED OPTIMIZATION: Keep character count tight so the CPU handles generation instantly
        short_text = text_content[:2000]
        if len(short_text.strip()) < 50:  
            return "Insufficient text available to compile an abstractive summary."
            
        try:
            # Tuned max_length down to 80 to prevent slow generation text loops
            res = summarizer(short_text, max_length=80, min_length=25, do_sample=False)
            
            # FIXED: Uses 'generated_text' dictionary key to match the text-generation task
            return res[0]['generated_text']
        except Exception as e:
            print(f"   [AI Processing Error]: {e}")
            return "Summary processing bypass window timeout."

    def main():
        if not os.path.exists(INPUT_DIR):
            print(f"Error: Target root directory '{INPUT_DIR}' not found.")
            return

        # Load the optimized model right before scanning files
        load_local_model()

        print(f"Scanning '{INPUT_DIR}' recursively for PDFs...")

        # Open the markdown file and write the index header
        with open(OUTPUT_FILE, "w", encoding="utf-8") as md_file:
            md_file.write(f"# Project Master Summary Document\n")
            md_file.write(f"*Generated locally via ultra-fast self-contained Transformer model for immediate deployment.*\n\n")
            md_file.write("---\n\n")

        current_section = ""
        pdf_count = 0

        # os.walk travels down through every subfolder recursively
        for root, dirs, files in os.walk(INPUT_DIR):
            pdf_files = sorted([f for f in files if f.lower().endswith('.pdf')])
            
            if not pdf_files:
                continue

            # Determine the relative folder name to use as a section header
            relative_folder = os.path.relpath(root, INPUT_DIR)
            if relative_folder == ".":
                relative_folder = "Root Files"

            # If we enter a new subfolder, write a sub-header in the markdown file
            if relative_folder != current_section:
                current_section = relative_folder
                with open(OUTPUT_FILE, "a", encoding="utf-8") as md_file:
                    md_file.write(f"## 📁 Section: {current_section.replace('_', ' ').title()}\n\n")
                    md_file.write("---\n\n")

            for filename in pdf_files:
                pdf_count += 1
                filepath = os.path.join(root, filename)
                print(f"[{pdf_count}] Fast Processing: {os.path.join(relative_folder, filename)}")

                raw_text = extract_text_from_pdf(filepath)

                if not raw_text.strip():
                    print(" -> Skipping empty or unreadable scanned PDF layout.")
                    continue

                print(" -> Running fast inference...")
                ai_summary = run_summarize(raw_text)

                # Append the file summary under the active sub-header section
                with open(OUTPUT_FILE, "a", encoding="utf-8") as md_file:
                    clean_title = filename.replace('_', ' ').replace('.pdf','')
                    md_file.write(f"### 📄 {clean_title}\n\n")
                    md_file.write(f"**Path:** `{os.path.join(relative_folder, filename)}`\n\n")
                    md_file.write(f"**Summary:**\n{ai_summary.strip()}\n\n")
                    md_file.write("\n---\n\n")
                
                print(" -> Summary appended.")

        if pdf_count == 0:
            print(f"No PDF files were discovered anywhere inside the '{INPUT_DIR}' directory tree.")
        else:
            print(f"\nSuccess! Completed parsing {pdf_count} PDFs across nested folders.")
            print(f"Unified documentation saved on your server to '{OUTPUT_FILE}'")

    main()