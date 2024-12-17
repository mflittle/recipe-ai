// /app/api/detect-ingredients/route.ts
import { NextResponse } from 'next/server';
import detector from '@/lib/imageProcessing';

const commonIngredients = [
  'milk', 'eggs', 'cheese', 'yogurt',
  'juice', 'water', 'soda',
  'lettuce', 'tomatoes', 'carrots',
  'apples', 'oranges',
  'chicken', 'beef',
  'butter', 'condiments'
];

// Map of containers to likely contents
const containerContents = new Map([
  ['carton', ['milk', 'juice', 'eggs']],
  ['bottle', ['water', 'juice', 'soda', 'tea']],
  ['jar', ['condiments', 'sauce']],
  ['container', ['leftovers', 'yogurt']],
]);

// Brand keywords to ingredient mapping
const brandIngredients = new Map([
  ['trader joe', 'milk'],
  ['organic', 'milk'],
  ['gold peak', 'tea'],
]);

function analyzeDescription(description: string): string[] {
  const text = description.toLowerCase();
  const detectedIngredients = new Set<string>();

  // Check for brands and their associated ingredients
  brandIngredients.forEach((ingredient, brand) => {
    if (text.includes(brand)) {
      detectedIngredients.add(ingredient);
    }
  });

  // Check for containers and their likely contents
  containerContents.forEach((contents, container) => {
    if (text.includes(container)) {
      contents.forEach(item => {
        if (text.includes(item)) {
          detectedIngredients.add(item);
        }
      });
    }
  });

  return Array.from(detectedIngredients);
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

    // Convert the image to base64
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

    const topDetection = detectionResult[0];
    
    // Check for refrigerator detection
    const isRefrigerator = detectionResult.some(item => {
      const label = item.label.toLowerCase();
      return (label.includes('refrigerator') || 
              label.includes('icebox') || 
              label.includes('fridge')) && 
              item.score > 0.5;
    });

    if (isRefrigerator) {
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

        let detectedIngredients: string[] = [];

        // Get ingredients from object detection
        const objectIngredients = detectionResult
          .filter(item => item.score > 0.5)
          .map(item => item.label.toLowerCase());

        // Get ingredients from BLIP description
        let descriptionIngredients: string[] = [];
        if (Array.isArray(ingredientResult) && ingredientResult[0]?.generated_text) {
          descriptionIngredients = analyzeDescription(ingredientResult[0].generated_text);
        }

        // Combine all detected ingredients
        detectedIngredients = [...new Set([
          ...objectIngredients,
          ...descriptionIngredients
        ])].filter(item => 
          !item.includes('refrigerator') && 
          !item.includes('icebox') && 
          !item.includes('fridge')
        );

        // Filter detected ingredients to only include common ingredients and their variations
        const validIngredients = detectedIngredients.filter(ingredient =>
          commonIngredients.some(common => ingredient.includes(common))
        );

        return NextResponse.json({
          isFood: true,
          ingredients: validIngredients,
          suggestedIngredients: commonIngredients.filter(item => 
            !validIngredients.some(detected => detected.includes(item))
          ),
          message: validIngredients.length > 0 
            ? "Here are the ingredients we detected, plus some suggestions:"
            : "We detected your refrigerator! Please select from these common ingredients:",
          detectedObject: {
            label: 'refrigerator',
            confidence: topDetection.score
          }
        });
      } catch (error) {
        return NextResponse.json({
          isFood: true,
          ingredients: [],
          suggestedIngredients: commonIngredients,
          message: "We detected your refrigerator! Please select from these common ingredients:",
          detectedObject: {
            label: 'refrigerator',
            confidence: topDetection.score
          }
        });
      }
    }

    // If no refrigerator detected
    return NextResponse.json({
      error: `This appears to be a photo of a ${topDetection.label} (${(topDetection.score * 100).toFixed(1)}% confidence). Please upload a photo of food or your refrigerator.`,
      isFood: false,
      ingredients: [],
      suggestedIngredients: commonIngredients,
      detectedObject: {
        label: topDetection.label,
        confidence: topDetection.score
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