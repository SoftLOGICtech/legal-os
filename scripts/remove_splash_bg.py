import os
from PIL import Image, ImageOps, ImageFilter
import numpy as np

def process_emblem(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    data = np.array(img)
    
    # Extract RGB channels
    r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]
    
    # The background is the outer cream/off-white textured paper (high brightness, low saturation)
    # The emblem consists of:
    # 1. Turquoise/teal patina (high green/blue, lower red, strong saturation)
    # 2. Central white-sandstone carved structure
    
    # Calculate distance from typical background paper color (~235, 230, 222)
    # or flood fill / distance mask from center
    h, w = r.shape
    cy, cx = h // 2, w // 2
    
    # Create an alpha mask based on color and distance
    # Background paper has r > 210, g > 205, b > 195 with very low color difference (abs(r-g) < 15, abs(g-b) < 15)
    # and is outside the emblem boundary
    
    # Let's compute color difference & luminance
    diff_rg = np.abs(r.astype(int) - g.astype(int))
    diff_gb = np.abs(g.astype(int) - b.astype(int))
    brightness = (r.astype(int) + g.astype(int) + b.astype(int)) / 3.0
    
    # Background is bright and greyish (low color difference)
    # BUT the white stone is also bright, so let's use a convex hull / floodfill from corners or edge threshold
    from scipy.ndimage import binary_fill_holes
    
    # Find emblem by edge detection and threshold
    gray = np.array(img.convert('L'))
    # Emblem has strong edges and texture
    # Distance from corners:
    y_coords, x_coords = np.ogrid[:h, :w]
    dist_from_center = np.sqrt((x_coords - cx)**2 + (y_coords - cy)**2)
    
    # Corner sampling of background color
    corner_pixels = np.concatenate([
        data[0:40, 0:40, :3].reshape(-1, 3),
        data[0:40, -40:, :3].reshape(-1, 3),
        data[-40:, 0:40, :3].reshape(-1, 3),
        data[-40:, -40:, :3].reshape(-1, 3)
    ])
    bg_mean = np.mean(corner_pixels, axis=0)
    
    color_dist = np.sqrt(np.sum((data[:,:,:3].astype(float) - bg_mean)**2, axis=2))
    
    # Create mask: where color_dist > 18 or inside the inner structure
    mask = (color_dist > 18)
    
    # Also clean up holes inside the emblem
    mask = binary_fill_holes(mask)
    
    # Smooth edges with a slight feather
    mask_img = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
    
    img.putalpha(mask_img)
    img.save(output_path, "PNG")
    print(f"Emblem saved to {output_path}")

def process_legal_os(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    data = np.array(img)
    
    # The text "Legal OS" is dark ink on light paper
    r, g, b = data[:,:,0], data[:,:,1], data[:,:,2]
    luminance = (r.astype(float) * 0.299 + g.astype(float) * 0.587 + b.astype(float) * 0.114)
    
    # Normalize: Background is ~220-250, Text is ~20-90
    # Invert text to be pure alpha
    # Text alpha is highest where luminance is lowest
    alpha = np.clip((210.0 - luminance) / 120.0 * 255.0, 0, 255).astype(np.uint8)
    
    # Create gold/white crisp text with this alpha
    new_data = np.zeros_like(data)
    # Give the text a bright gold / white gradient: (201, 168, 76) or pure white with subtle gold
    new_data[:,:,0] = 223 # Gold R
    new_data[:,:,1] = 192 # Gold G
    new_data[:,:,2] = 106 # Gold B
    new_data[:,:,3] = alpha
    
    res = Image.fromarray(new_data, "RGBA")
    # Smooth text slightly
    res.save(output_path, "PNG")
    print(f"Legal OS saved to {output_path}")

if __name__ == '__main__':
    emblem_in = "dashboard/public/splash_emblem.jpg"
    emblem_out = "dashboard/public/splash_emblem.png"
    emblem_out_src = "dashboard/src/assets/splash_emblem.png"
    
    legal_in = "dashboard/public/splash_legal_os.jpg"
    legal_out = "dashboard/public/splash_legal_os.png"
    legal_out_src = "dashboard/src/assets/splash_legal_os.png"
    
    try:
        import scipy.ndimage
        process_emblem(emblem_in, emblem_out)
    except Exception as e:
        print(f"scipy not found, using pure PIL fallback: {e}")
        # Fallback using PIL
        img = Image.open(emblem_in).convert("RGBA")
        data = np.array(img)
        corner_bg = np.mean(data[:30, :30, :3], axis=(0,1))
        diff = np.sqrt(np.sum((data[:,:,:3].astype(float) - corner_bg)**2, axis=2))
        alpha = np.clip((diff - 14.0) * 12.0, 0, 255).astype(np.uint8)
        img.putalpha(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(1)))
        img.save(emblem_out, "PNG")
        
    img_e = Image.open(emblem_out)
    img_e.save(emblem_out_src, "PNG")
    
    process_legal_os(legal_in, legal_out)
    img_l = Image.open(legal_out)
    img_l.save(legal_out_src, "PNG")
    print("Done!")
