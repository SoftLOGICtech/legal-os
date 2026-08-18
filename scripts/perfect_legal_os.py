import cv2
import numpy as np

# Load Legal OS image
img = cv2.imread('dashboard/public/splash_legal_os.jpg')
h, w = img.shape[:2]

# Convert to grayscale
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

# The text is dark, background is light paper
# Background is > 180, text is < 120
# Invert so text is bright
inv = 255 - gray

# Threshold text
# Text pixels have high values in inv
# Create smooth alpha channel
alpha = np.zeros((h, w), dtype=np.uint8)
# Linear interpolation between dark and bright
alpha = np.clip((inv.astype(float) - 40.0) / (180.0 - 40.0) * 255.0, 0, 255).astype(np.uint8)

# Clear borders (10px margin)
alpha[0:15, :] = 0
alpha[-15:, :] = 0
alpha[:, 0:15] = 0
alpha[:, -15:] = 0

# Smooth alpha
alpha = cv2.GaussianBlur(alpha, (3, 3), 0)

# Create gold / bright white text foreground
# RGB: 237, 217, 139 (Gold-300 / Gold-400)
fg_r = np.full((h, w), 237, dtype=np.uint8)
fg_g = np.full((h, w), 217, dtype=np.uint8)
fg_b = np.full((h, w), 139, dtype=np.uint8)

rgba = cv2.merge([fg_b, fg_g, fg_r, alpha])

cv2.imwrite('dashboard/public/splash_legal_os.png', rgba)
cv2.imwrite('dashboard/src/assets/splash_legal_os.png', rgba)
print(f"Legal OS text perfected: {w}x{h}, non-zero alpha: {np.count_nonzero(alpha)}")
