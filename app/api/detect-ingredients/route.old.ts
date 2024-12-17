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

    // Check if the result is an array and has any items
    if (!Array.isArray(detectionResult)) {
      throw new Error('Unexpected response format from detection model');
    }

    // Get the top detected item
    const topDetection = detectionResult[0];
    
    // Check specifically for refrigerator detection
    const isRefrigerator = detectionResult.some(item => {
      const label = item.label.toLowerCase();
      return (label.includes('refrigerator') || 
              label.includes('icebox') || 
              label.includes('fridge')) && 
              item.score > 0.5;
    });

    if (isRefrigerator) {
      // Process refrigerator contents with BLIP
      try {
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

        // Process ingredients from both models
        detectedIngredients = detectionResult
          .filter(item => item.score > 0.5)
          .map(item => item.label.toLowerCase());

        // Add items from BLIP description
        if (typeof ingredientResult === 'string') {
          detectedIngredients = [...detectedIngredients, ...extractIngredientsFromDescription(ingredientResult)];
        } else if (Array.isArray(ingredientResult) && ingredientResult.length > 0) {
          if (typeof ingredientResult[0] === 'string') {
            detectedIngredients = [...detectedIngredients, ...extractIngredientsFromDescription(ingredientResult[0])];
          } else if (ingredientResult[0]?.generated_text) {
            detectedIngredients = [...detectedIngredients, ...extractIngredientsFromDescription(ingredientResult[0].generated_text)];
          }
        }

        // Remove duplicates and standardize
        detectedIngredients = [...new Set(detectedIngredients)].map(item => item.toLowerCase());

        // Filter out non-food items
        const foodItems = detectedIngredients.filter(item => !item.includes('refrigerator'));

        return NextResponse.json({
          isFood: true,
          ingredients: foodItems,
          suggestedIngredients: commonIngredients.filter(item => !foodItems.includes(item)),
          message: foodItems.length > 0 
            ? "Here are the ingredients we detected, plus some suggestions:"
            : "We detected your refrigerator! Please select from these common ingredients:",
          detectedObject: {
            label: 'refrigerator',
            confidence: topDetection.score
          }
        });
      } catch (error) {
        // If BLIP fails, still return success with common ingredients
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

function extractIngredientsFromDescription(description: string): string[] {
  const words = description.toLowerCase().split(/[\s,]+/);
  
  const filterWords = new Set([
    'a', 'the', 'and', 'with', 'contains', 'made', 'of', 'from', 
    'in', 'on', 'at', 'to', 'for', 'is', 'are', 'there', 'food',
    'dish', 'meal', 'recipe', 'picture', 'image', 'photo', 'shows',
    'showing', 'displayed', 'multiple', 'various', 'several', 'many'
  ]);
  
  const ingredients = words
    .filter(word => !filterWords.has(word))
    .filter(word => word.length > 2)
    .map(word => word.trim())
    .filter(Boolean);

  return [...new Set(ingredients)];
}