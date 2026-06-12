import os
import sys
import re
from collections import Counter
from pypdf import PdfReader

def summariser():
    # Configuration
    INPUT_DIR = "files"  # Points to your /files folder
    OUTPUT_FILE = "summary/summary.md"

    # Make sure the output directory exists before writing to it
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

    def extract_text_from_pdf(filepath):
        """Extracts text from the first 5 pages to provide enough context for a deep summary."""
        text = ""
        try:
            reader = PdfReader(filepath)
            # Read up to 5 pages to capture a richer text base for better summaries
            pages_to_read = min(len(reader.pages), 5)
            for i in range(pages_to_read):
                page_text = reader.pages[i].extract_text()
                if page_text:
                    text += page_text + "\n"
        except Exception as e:
            print(f"   [Error reading PDF {os.path.basename(filepath)}]: {e}")
        return text

    def run_summarize(text_content, num_sentences=6):
        """
        Advanced Extractive Summary Engine (0 MB footprint).
        Extracts prominent keywords and pairs them with an extended, highly-scored 
        context window to produce a substantial summary paragraph.
        """
        if len(text_content.strip()) < 150:  
            return "**Summary:** Insufficient text content available in this document.", "**Keywords:** None"
            
        # Clean up excessive spaces and split text into structural sentences cleanly
        text_clean = re.sub(r'\s+', ' ', text_content.strip())
        sentences = re.split(r'(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?)\s', text_clean)
        sentences = [s.strip() for s in sentences if len(s.strip()) > 20] # Skip tiny fragments
        
        if not sentences:
            return "**Summary:** No readable structural sentences found.", "**Keywords:** None"

        # Tokenize words for statistical frequency distribution
        words = re.findall(r'\b\w+\b', text_clean.lower())
        
        # Extended English stop words filter to extract high-value technical vocabulary
        stop_words = {
            'the', 'and', 'a', 'of', 'to', 'is', 'in', 'that', 'it', 'for', 'on', 'with', 
            'as', 'are', 'by', 'an', 'be', 'at', 'from', 'or', 'was', 'were', 'this', 'that',
            'this', 'these', 'those', 'then', 'their', 'they', 'them', 'but', 'not', 'with',
            'using', 'used', 'which', 'each', 'has', 'have', 'can', 'also', 'more', 'such'
        }
        filtered_words = [word for word in words if word not in stop_words and len(word) > 3 and not word.isdigit()]
        
        if not filtered_words:
            # Fallback for document exceptions
            return " ".join(sentences[:3]), "General Content"

        # Calculate frequency weights
        word_frequencies = Counter(filtered_words)
        max_frequency = max(word_frequencies.values())
        
        # Extract top 5 unique technical terms as metadata keywords
        top_keywords = [item[0] for item in word_frequencies.most_common(5)]
        keywords_str = ", ".join(top_keywords).title()

        # Normalize word weights
        for word in word_frequencies:
            word_frequencies[word] = word_frequencies[word] / max_frequency

        # Matrix Scoring: Weight sentences based on keyword combinations
        sentence_scores = {}
        for sentence in sentences:
            sentence_words = re.findall(r'\b\w+\b', sentence.lower())
            # Basic score based on word frequency summation
            score = sum(word_frequencies[word] for word in sentence_words if word in word_frequencies)
            
            # Boost sentences that appear near the start of paragraphs/documents (usually introductory)
            idx = sentences.index(sentence)
            if idx < 5:
                score *= 1.2
                
            sentence_scores[sentence] = score

        # Grab a larger context window (6 sentences instead of 3)
        top_sentences = sorted(sentence_scores, key=sentence_scores.get, reverse=True)[:num_sentences]
        
        # Sort chronologically so it reads naturally as a paragraph narrative
        top_sentences.sort(key=lambda s: sentences.index(s))
        
        # Format sentences cleanly into a structured paragraph block
        summary_paragraph = " ".join(top_sentences)
        
        return summary_paragraph, keywords_str

    def main():
        if not os.path.exists(INPUT_DIR):
            print(f"Error: Target root directory '{INPUT_DIR}' not found.")
            return

        print(f"Scanning '{INPUT_DIR}' recursively for PDFs using advanced context windowing...")

        # Open the markdown file and write the index header
        with open(OUTPUT_FILE, "w", encoding="utf-8") as md_file:
            md_file.write(f"# Project Master Summary Document\n")
            md_file.write(f"*Generated locally via zero-footprint deep algorithmic extraction summaries.*\n\n")
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
                print(f"[{pdf_count}] Analyzing Context: {os.path.join(relative_folder, filename)}")

                raw_text = extract_text_from_pdf(filepath)

                if not raw_text.strip():
                    print(" -> Skipping empty or unreadable scanned PDF layout.")
                    continue

                # Run advanced summarizer
                ai_summary, keywords = run_summarize(raw_text, num_sentences=6)

                # Append the expanded file summary under the active sub-header section
                with open(OUTPUT_FILE, "a", encoding="utf-8") as md_file:
                    clean_title = filename.replace('_', ' ').replace('.pdf','')
                    md_file.write(f"### 📄 {clean_title}\n\n")
                    md_file.write(f"**Path:** `{os.path.join(relative_folder, filename)}`\n\n")
                    md_file.write(f"**Core Core Concepts:** `{keywords}`\n\n")
                    md_file.write(f"**Executive Summary:**\n{ai_summary.strip()}\n\n")
                    md_file.write("\n---\n\n")
                
                print(" -> Comprehensive summary appended.")

        if pdf_count == 0:
            print(f"No PDF files were discovered anywhere inside the '{INPUT_DIR}' directory tree.")
        else:
            print(f"\nSuccess! Completed compiling {pdf_count} rich summaries across folders.")
            print(f"Unified documentation saved on your server to '{OUTPUT_FILE}'")

    main()