// /app/api/detect-ingredients/route.ts
import { NextResponse } from 'next/server';

const FRIDGE_CONFIDENCE_THRESHOLD = 0.25; // Lowered to catch more cases
const ITEM_CONFIDENCE_THRESHOLD = 0.15;   // Lower threshold for items

const commonIngredients = [
  'milk', 'eggs', 'cheese', 'yogurt',
  'juice', 'water', 'soda',
  'lettuce', 'tomatoes', 'carrots',
  'apples', 'oranges',
  'chicken', 'beef',
  'butter', 'condiments'
];

// Map of containers/objects to likely contents
const containerContents = new Map([
  ['bottle', ['juice', 'water', 'soda', 'tea']],
  ['carton', ['milk', 'juice']],
  ['jar', ['condiments']],
  ['container', ['leftovers', 'yogurt']],
  ['bowl', ['leftovers', 'fruit']],
  ['fruit', ['apples', 'oranges']],
  ['vegetable', ['lettuce', 'tomatoes', 'carrots']],
]);

function analyzeContents(detectionResult: any[], description: string): string[] {
  const detectedItems = new Set<string>();
  
  // Check the description
  const descLower = description.toLowerCase();
  
  // Look for specific brands/items in description
  if (descLower.includes('trader') || descLower.includes('organic')) {
    detectedItems.add('milk');
  }
  if (descLower.includes('gold peak') || descLower.includes('tea')) {
    detectedItems.add('tea');
  }

  // Analyze each detected object
  detectionResult.forEach(detection => {
    if (detection.score > ITEM_CONFIDENCE_THRESHOLD) {
      const label = detection.label.toLowerCase();
      
      // Check for direct matches with common ingredients
      commonIngredients.forEach(ingredient => {
        if (label.includes(ingredient)) {
          detectedItems.add(ingredient);
        }
      });

      // Check container mapping
      containerContents.forEach((contents, container) => {
        if (label.includes(container)) {
          contents.forEach(item => detectedItems.add(item));
        }
      });
    }
  });

  return Array.from(detectedItems);
}

export async function POST(request: Request) {
  console.log('=== API Route Start ===');
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return NextResponse.json(
        { 
          error: 'No image provided',
          isFood: false,
          ingredients: [],
          suggestedIngredients: commonIngredients
        },
        { status: 400 }
      );
    }

    // Convert image to base64
    const bytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');

    // Use ResNet-50 for object detection
    const detectionResponse = await fetch(
      "https://api-inference.huggingface.co/models/microsoft/resnet-50",
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({
          inputs: base64Image,
        }),
      }
    );

    const detectionResult = await detectionResponse.json();
    console.log('Detection Result:', detectionResult);

    if (!Array.isArray(detectionResult)) {
      throw new Error('Unexpected response format from detection model');
    }

    // Check for refrigerator with lower threshold
    const fridgeDetection = detectionResult.find(item => {
      const label = item.label.toLowerCase();
      return (label.includes('refrigerator') || 
              label.includes('icebox') || 
              label.includes('fridge')) && 
              item.score > FRIDGE_CONFIDENCE_THRESHOLD;
    });

    if (fridgeDetection) {
      try {
        // Get BLIP description
        const ingredientResponse = await fetch(
          "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-base",
          {
            headers: {
              Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
              "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify({
              inputs: base64Image,
            }),
          }
        );

        const ingredientResult = await ingredientResponse.json();
        console.log('Ingredient Description Result:', ingredientResult);

        let description = '';
        if (Array.isArray(ingredientResult) && ingredientResult[0]?.generated_text) {
          description = ingredientResult[0].generated_text;
        }

        // Analyze contents using both detection and description
        const detectedIngredients = analyzeContents(detectionResult, description);

        console.log('Detected Ingredients:', detectedIngredients);

        return NextResponse.json({
          isFood: true,
          ingredients: detectedIngredients,
          suggestedIngredients: commonIngredients.filter(
            item => !detectedIngredients.includes(item)
          ),
          message: detectedIngredients.length > 0 
            ? "Here are the ingredients we detected, plus some suggestions:"
            : "We detected your refrigerator! Please select from these common ingredients:",
          detectedObject: {
            label: fridgeDetection.label,
            confidence: fridgeDetection.score
          }
        });

      } catch (error) {
        // If BLIP fails, still return success with default ingredients
        return NextResponse.json({
          isFood: true,
          ingredients: [],
          suggestedIngredients: commonIngredients,
          message: "We detected your refrigerator! Please select from these common ingredients:",
          detectedObject: {
            label: fridgeDetection.label,
            confidence: fridgeDetection.score
          }
        });
      }
    }

    // No refrigerator detected
    return NextResponse.json({
      error: `This appears to be a photo of a ${detectionResult[0].label} (${(detectionResult[0].score * 100).toFixed(1)}% confidence). Please upload a photo of a refrigerator.`,
      isFood: false,
      ingredients: [],
      suggestedIngredients: commonIngredients,
      detectedObject: {
        label: detectionResult[0].label,
        confidence: detectionResult[0].score
      }
    });

  } catch (err) {
    const error = err as Error;
    console.error('Error processing image:', error);
    return NextResponse.json(
      { 
        error: error?.message || 'Failed to process image',
        isFood: false,
        ingredients: [],
        suggestedIngredients: commonIngredients
      },
      { status: 500 }
    );
  }
}