import os
from PIL import Image

def process_socrates_logo(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()
    
    new_data = []
    for item in datas:
        # Calculate grayscale intensity
        r, g, b, a = item
        gray = int(0.299 * r + 0.587 * g + 0.114 * b)
        
        # Define thresholds for smoothing
        # Below 100 is fully opaque line
        # Above 210 is fully transparent background (handles the checkerboard)
        high_threshold = 210
        low_threshold = 100
        
        if gray >= high_threshold:
            alpha = 0
        elif gray <= low_threshold:
            alpha = 255
        else:
            # Linear interpolation for anti-aliasing
            alpha = int(255 * (high_threshold - gray) / (high_threshold - low_threshold))
            
        # We can make the lines pure dark gray/black to look clean and aesthetic
        new_data.append((0, 0, 0, alpha))
        
    img.putdata(new_data)
    
    # Crop the image to remove unnecessary empty space around the bust
    # Let's find the bounding box of the non-transparent pixels
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        
    img.save(output_path, "PNG")
    print(f"Successfully processed logo and saved to {output_path}")

if __name__ == "__main__":
    input_file = "/home/ad3m/Downloads/outline2.jpg"
    output_file = "/home/ad3m/hack/study_chat/static/socrates.png"
    process_socrates_logo(input_file, output_file)
