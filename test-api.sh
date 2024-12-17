#!/bin/bash
# Test with single image
echo "Testing API endpoint with test image..."
curl -X POST -F "image=@test-images/test-fridge.jpg" \
    http://localhost:3000/api/detect-ingredients

# Test with multiple images
for image in test-images/*.jpg; do
    echo -e "\nTesting with image: $image"
    curl -X POST -F "image=@$image" \
        http://localhost:3000/api/detect-ingredients
done
