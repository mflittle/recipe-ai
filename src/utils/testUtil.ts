import fs from 'fs';
import sharp from 'sharp';
import detector from '../lib/imageProcessing';

export async function testImageDetection(imagePath: string): Promise<string[]> {
    try {
        console.log('Starting image detection test...');
        
        // Check image format before processing
        const imageInfo = await sharp(imagePath).metadata();
        console.log('Original image format:', imageInfo.format);
        
        if (imageInfo.format === 'heif') {
            throw new Error('HEIF format not supported. Please convert the image to JPEG format using Preview app first.');
        }
        
        console.log('Processing image:', imagePath);
        const imageBuffer = await sharp(imagePath)
            .jpeg()
            .resize(800, 600, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .toBuffer();
            
        console.log('Image converted to JPEG, size:', imageBuffer.length);
        
        console.log('Initializing detector...');
        await detector.initialize();
        
        console.log('Processing image with detector...');
        const ingredients = await detector.detectIngredients(imageBuffer);
        
        console.log('Detection Results:');
        console.log('------------------');
        console.log(`Found ${ingredients.length} ingredients:`);
        ingredients.forEach((ingredient: string, index: number) => {
            console.log(`${index + 1}. ${ingredient}`);
        });
        
        return ingredients;
    } catch (error) {
        console.error('Test failed:', error);
        if (error instanceof Error) {
            console.error('Error details:', {
                name: error.name,
                message: error.message
            });
        }
        throw error;
    }
}