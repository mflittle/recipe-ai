// src/app/page.tsx
'use client';

import { useState } from 'react';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, Plus } from 'lucide-react';
import IngredientSelector from '@/components/IngredientSelector';

interface DetectedIngredient {
  name: string;
  confidence: number;
}

interface DetectedObject {
  label: string;
  confidence: number;
}

interface Recipe {
  name: string;
  ingredients: string[];
  instructions: string[];
  missingIngredients: string[];
}

export default function Home() {
  const [detectedIngredients, setDetectedIngredients] = useState<string[]>([]);
  const [suggestedIngredients, setSuggestedIngredients] = useState<string[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [hasUploadedImage, setHasUploadedImage] = useState(false);
  const [uploadId, setUploadId] = useState(0);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedObject, setDetectedObject] = useState<DetectedObject | null>(null);

  const handleImageProcessed = (ingredients: string[], suggestedIngredients: string[]) => {
    console.log('handleImageProcessed called with:', {
      ingredients,
      suggestedIngredients
    });
    
    setDetectedIngredients(ingredients);
    setSuggestedIngredients(suggestedIngredients);
    setHasUploadedImage(true);
    setError(null);
  };
  
  const handleImageUploadError = (error: string, detectedObj?: DetectedObject) => {
    console.log('handleImageUploadError called with:', {
      error,
      detectedObj
    });
    
    setError(error);
    setDetectedObject(detectedObj || null);
    setHasUploadedImage(false);
    setDetectedIngredients([]);
    setSuggestedIngredients([]);
  };

  const toggleIngredient = (ingredient: string) => {
    setSelectedIngredients(prev =>
      prev.includes(ingredient)
        ? prev.filter(i => i !== ingredient)
        : [...prev, ingredient]
    );
  };

  const generateRecipes = async () => {
    if (selectedIngredients.length === 0) {
      setError('Please select at least one ingredient');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-recipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ingredients: selectedIngredients
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate recipes');
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      
      setRecipes(data.recipes);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to generate recipes');
      console.error('Recipe generation error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Recipe AI</h1>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload Refrigerator Image</CardTitle>
          </CardHeader>
          <CardContent>
            <ImageUpload 
              onImageProcessed={handleImageProcessed}
              onError={handleImageUploadError}
            />
            {error && (
              <Alert className="mt-4" variant="destructive">
                <AlertDescription>
                  {error}
                  {detectedObject && (
                    <div className="mt-2">
                      Detected: {detectedObject.label} 
                      ({(detectedObject.confidence * 100).toFixed(1)}% confidence)
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {(hasUploadedImage || suggestedIngredients.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Ingredients Selection</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {detectedIngredients.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2">Detected Ingredients:</h3>
                    <div className="flex flex-wrap gap-2">
                      {detectedIngredients.map((ingredient) => (
                        <button
                          key={ingredient}
                          onClick={() => toggleIngredient(ingredient)}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                            selectedIngredients.includes(ingredient)
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {selectedIngredients.includes(ingredient) ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                          {ingredient}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {suggestedIngredients.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2">Additional Ingredients:</h3>
                    <div className="flex flex-wrap gap-2">
                      {suggestedIngredients.map((ingredient) => (
                        <button
                          key={ingredient}
                          onClick={() => toggleIngredient(ingredient)}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                            selectedIngredients.includes(ingredient)
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {selectedIngredients.includes(ingredient) ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                          {ingredient}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <Button 
                  onClick={generateRecipes}
                  disabled={isGenerating || selectedIngredients.length === 0}
                  className="w-full mt-4"
                >
                  {isGenerating ? 'Generating Recipes...' : 'Generate Recipes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {recipes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Generated Recipes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {recipes.map((recipe, index) => (
                  <div key={index} className="space-y-4">
                    <h3 className="text-xl font-semibold">{recipe.name}</h3>
                    
                    {recipe.missingIngredients.length > 0 && (
                      <div className="bg-yellow-50 p-4 rounded-lg">
                        <h4 className="font-medium text-yellow-800 mb-2">Missing Ingredients:</h4>
                        <ul className="list-disc pl-5 text-yellow-700">
                          {recipe.missingIngredients.map((ingredient, idx) => (
                            <li key={idx}>{ingredient}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    <div>
                      <h4 className="font-medium mb-2">Ingredients:</h4>
                      <ul className="list-disc pl-5">
                        {recipe.ingredients.map((ingredient, idx) => (
                          <li key={idx}>{ingredient}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">Instructions:</h4>
                      <ol className="list-decimal pl-5">
                        {recipe.instructions.map((step, idx) => (
                          <li key={idx} className="mb-2">{step}</li>
                        ))}
                      </ol>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}