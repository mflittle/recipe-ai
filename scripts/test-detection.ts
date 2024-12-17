import path from 'path';
import { testImageDetection } from '../src/utils/testUtil';

async function runTests() {
    const testImages = [
        'test-fridge-jpeg.jpg'
    ];

    for (const image of testImages) {
        console.log(`\nTesting image: ${image}`);
        console.log('=================');
        try {
            const imagePath = path.join(__dirname, '../test-images', image);
            const ingredients = await testImageDetection(imagePath);
        } catch (error) {
            if (error instanceof Error) {
                console.error(`Failed testing ${image}:`, error.stack || error.message);
            } else {
                console.error(`Failed testing ${image}:`, error);
            }
        }
    }
}

runTests().catch(console.error);