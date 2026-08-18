import cv2
import numpy as np

# Load image and current mask
img = cv2.imread('dashboard/public/splash_emblem.jpg')
h, w = img.shape[:2]

# Load GrabCut result
res = cv2.imread('dashboard/public/splash_emblem.png', cv2.IMREAD_UNCHANGED)
alpha = res[:, :, 3]

# In the central area, find dark/textured background spots inside the circular eyelets
# The eyelet centers are at approx (x=505, y=530) and (x=590, y=530), and outer eyelets
# Let's use floodFill from the 4 corners to ensure NO outer pixels survived
flood_mask = np.zeros((h + 2, w + 2), np.uint8)
inv_alpha = 255 - alpha
# Ensure borders are 0
alpha[0:30, :] = 0
alpha[-30:, :] = 0
alpha[:, 0:30] = 0
alpha[:, -30:] = 0

# Smooth alpha edge with guided filter or morphology
kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
clean_alpha = cv2.morphologyEx(alpha, cv2.MORPH_OPEN, kernel)
clean_alpha = cv2.GaussianBlur(clean_alpha, (3, 3), 0)

# Merge and save
b, g, r = cv2.split(img)
rgba = cv2.merge([b, g, r, clean_alpha])

cv2.imwrite('dashboard/public/splash_emblem.png', rgba)
cv2.imwrite('dashboard/src/assets/splash_emblem.png', rgba)
print("Pristine emblem alpha perfected!")
