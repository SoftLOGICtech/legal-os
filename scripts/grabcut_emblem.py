import cv2
import numpy as np

# Load image
img = cv2.imread('dashboard/public/splash_emblem.jpg')
h, w = img.shape[:2]

# Initialize mask for GrabCut
# 0 = cv2.GC_BGD, 1 = cv2.GC_FGD, 2 = cv2.GC_PR_BGD, 3 = cv2.GC_PR_FGD
mask = np.zeros((h, w), np.uint8)

# The emblem is strictly inside the central bounding box
# Margin of 15% on all sides
rect = (int(w * 0.20), int(h * 0.15), int(w * 0.60), int(h * 0.70))

bgdModel = np.zeros((1, 65), np.float64)
fgdModel = np.zeros((1, 65), np.float64)

cv2.grabCut(img, mask, rect, bgdModel, fgdModel, 7, cv2.GC_INIT_WITH_RECT)

# Mark definite background outside the rect
mask[0:int(h*0.12), :] = cv2.GC_BGD
mask[int(h*0.88):, :] = cv2.GC_BGD
mask[:, 0:int(w*0.15)] = cv2.GC_BGD
mask[:, int(w*0.85):] = cv2.GC_BGD

# Create binary mask where FG or PR_FG
bin_mask = np.where((mask == 1) | (mask == 3), 255, 0).astype('uint8')

# Find largest connected components (the emblem)
contours, _ = cv2.findContours(bin_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
clean_mask = np.zeros((h, w), dtype=np.uint8)
if contours:
    # Filter contours with reasonable area
    emblem_contours = [c for c in contours if cv2.contourArea(c) > 5000]
    cv2.drawContours(clean_mask, emblem_contours, -1, 255, thickness=cv2.FILLED)

# Check for inner holes (eyelets inside the circles)
# The circles in the emblem have hollow eyelet holes:
# Let's find eyelets by color/luminance inside the bounding area
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
# Soften edges for antialiasing
clean_mask = cv2.GaussianBlur(clean_mask, (5, 5), 0)

# Merge into RGBA
b, g, r = cv2.split(img)
rgba = cv2.merge([b, g, r, clean_mask])

# Save output
cv2.imwrite('dashboard/public/splash_emblem.png', rgba)
cv2.imwrite('dashboard/src/assets/splash_emblem.png', rgba)
print(f"Emblem processed with OpenCV GrabCut: {w}x{h}, non-zero alpha: {np.count_nonzero(clean_mask)}")
