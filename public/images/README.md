# Item Images Directory

This directory contains images for items in the gambling site.

## How to Add Images

1. **Image Format**: Use PNG, JPG, or WebP formats
2. **Image Size**: Recommended 128x128 pixels or larger (will be scaled down)
3. **Naming**: Use descriptive names like `phoenix-feather.png`, `wizard-staff.png`, etc.
4. **Placement**: Place images directly in this directory

## Image Fallback System

The site has a robust fallback system:
- If an image exists and loads successfully, it will be displayed
- If an image is missing or fails to load, a rarity-based icon will be shown instead
- No errors will occur if images are missing

## Current Missing Images

Based on the console logs, these images are currently missing:
- `phoenix-feather.png`
- `siren-pearl.png`
- `wizard-staff.png`
- `seashell.png`
- `fortune-crown.png`
- `crystal-orb.png`
- `golden-dice.png`
- `ruby-chips.png`

## Adding Images

Simply place the image files in this directory with the exact names referenced in your item data. The system will automatically detect and display them.

## Image Paths

Images are served from `/images/filename.png` in the web application. 