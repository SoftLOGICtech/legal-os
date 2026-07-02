from PIL import Image

def remove_background(img_path, output_path, tolerance=40):
    img = Image.open(img_path).convert("RGBA")
    width, height = img.size
    
    # Load pixels
    pixels = img.load()
    
    # Get corner colors as reference for background
    corners = [pixels[0, 0], pixels[width-1, 0], pixels[0, height-1], pixels[width-1, height-1]]
    # Use top-left corner as primary background color
    bg_color = corners[0]
    
    # BFS flood fill from all 4 corners to find connected background pixels
    visited = [[False for _ in range(height)] for _ in range(width)]
    queue = []
    
    # Initialize queue with corners
    for cx, cy in [(0, 0), (width-1, 0), (0, height-1), (width-1, height-1)]:
        queue.append((cx, cy))
        visited[cx][cy] = True
        
    def is_similar(c1, c2):
        return (abs(c1[0] - c2[0]) < tolerance and
                abs(c1[1] - c2[1]) < tolerance and
                abs(c1[2] - c2[2]) < tolerance)
                
    while queue:
        x, y = queue.pop(0)
        
        # Turn pixel transparent
        curr = pixels[x, y]
        pixels[x, y] = (curr[0], curr[1], curr[2], 0)
        
        # Traverse 4 directions
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < width and 0 <= ny < height:
                if not visited[nx][ny]:
                    if is_similar(pixels[nx, ny], bg_color):
                        visited[nx][ny] = True
                        queue.append((nx, ny))
                        
    img.save(output_path, "PNG")
    print(f"Background successfully removed. Saved to {output_path}")

# Run for Sam Ogola's photo
remove_background("sam ogola advocates/src/sam ogola.png", "sam ogola advocates/src/sam_ogola_transparent.png", tolerance=45)
