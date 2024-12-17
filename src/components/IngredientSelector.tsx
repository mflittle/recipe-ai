import React, { useState, useEffect } from 'react';
import { Plus, Minus, Search } from 'lucide-react';

interface DetectedIngredient {
  name: string;
  confidence: number;
}

interface IngredientSelectorProps {
  detectedIngredients: DetectedIngredient[];
  uploadId: number;
  onSelectedIngredientsChange: (ingredients: string[]) => void;
}

const commonIngredients = [
  { name: 'Milk', category: 'Dairy' },
  { name: 'Juice', category: 'Beverages' },
  { name: 'Peanut Butter', category: 'Condiments' },
  { name: 'Hot Dogs', category: 'Meat' },
  { name: 'Deli Meat', category: 'Meat' },
  { name: 'Jelly', category: 'Condiments' },
  { name: 'Bread', category: 'Bakery' },
  { name: 'Cheese', category: 'Dairy' },
  { name: 'Tomato Sauce', category: 'Condiments' },
  { name: 'Eggs', category: 'Dairy' },
  { name: 'Butter', category: 'Dairy' },
  { name: 'Yogurt', category: 'Dairy' },
  { name: 'Lettuce', category: 'Produce' },
  { name: 'Carrots', category: 'Produce' },
  { name: 'Onions', category: 'Produce' },
  { name: 'Apples', category: 'Produce' },
  { name: 'Orange Juice', category: 'Beverages' },
  { name: 'Mustard', category: 'Condiments' },
  { name: 'Mayonnaise', category: 'Condiments' },
  { name: 'Lunch Meat', category: 'Meat' }
];

export default function IngredientSelector({ 
  detectedIngredients, 
  uploadId, 
  onSelectedIngredientsChange 
}: IngredientSelectorProps) {
  const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Reset everything when uploadId changes
  useEffect(() => {
    setSelectedIngredients(new Set());
    setSearchTerm('');
  }, [uploadId]);

  // Set selected ingredients after clearing
  useEffect(() => {
    if (detectedIngredients.length > 0) {
      setSelectedIngredients(new Set(detectedIngredients.map(i => i.name)));
    }
  }, [detectedIngredients]);

  // Notify parent component when selected ingredients change
  useEffect(() => {
    onSelectedIngredientsChange(Array.from(selectedIngredients));
  }, [selectedIngredients, onSelectedIngredientsChange]);

  const toggleIngredient = (ingredient: string) => {
    const newSelected = new Set(selectedIngredients);
    if (newSelected.has(ingredient)) {
      newSelected.delete(ingredient);
    } else {
      newSelected.add(ingredient);
    }
    setSelectedIngredients(newSelected);
  };

  const filteredIngredients = commonIngredients.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Detection Results Section */}
      {detectedIngredients.length > 0 ? (
        <div>
          <h3 className="text-lg font-semibold mb-4">Detected Ingredients</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {detectedIngredients.map((item, index) => (
              <div 
                key={index} 
                className="grid grid-cols-2 gap-4 p-4 bg-secondary/50 rounded-lg"
              >
                <div className="text-base font-medium">{item.name}</div>
                <div className="text-sm text-muted-foreground text-right">
                  {(item.confidence * 100).toFixed(1)}% confidence
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4 bg-secondary/50 rounded-lg">
          <p className="text-muted-foreground">
            No ingredients were detected. Please select from common items below or add your own.
          </p>
        </div>
      )}

      {/* Common Ingredients Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Add Ingredients</h3>
        <div className="space-y-4">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
            <input
              type="text"
              placeholder="Search ingredients..."
              className="w-full pl-10 pr-4 py-2 bg-secondary/50 rounded-lg border-0"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Ingredients Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredIngredients.map((item, index) => (
              <div
                key={index}
                className="flex justify-between items-center p-4 bg-secondary/50 rounded-lg"
              >
                <div>
                  <span className="font-medium">{item.name}</span>
                  <span className="text-sm text-muted-foreground ml-2">({item.category})</span>
                </div>
                <button
                  onClick={() => toggleIngredient(item.name)}
                  className={`p-1.5 rounded-full hover:bg-background ${
                    selectedIngredients.has(item.name)
                      ? 'text-destructive'
                      : 'text-primary'
                  }`}
                >
                  {selectedIngredients.has(item.name) ? (
                    <Minus size={20} />
                  ) : (
                    <Plus size={20} />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Selected Items Summary */}
      {selectedIngredients.size > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Selected Ingredients</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from(selectedIngredients).map((ingredient, index) => (
              <div
                key={index}
                className="p-3 bg-secondary/50 rounded-lg text-center"
              >
                <span className="text-sm font-medium">{ingredient}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}