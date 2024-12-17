// src/lib/imageProcessing.ts
import * as tf from '@tensorflow/tfjs';
import * as tfnode from '@tensorflow/tfjs-node';

interface Detection {
  label: string;
  score: number;
}

interface DetectionResult {
  ingredients: string[];
  isRefrigerator: boolean;
  rawDetections: Detection[];
}

export class IngredientDetector {
  public initialized: boolean = false;
  private model: any;
  private readonly confidenceThreshold = 0.2;
  private isInitializing: boolean = false;

  private readonly foodLabels = new Set([
    // Common containers
    'bottle', 'carton', 'container', 'jar', 'package',
    
    // Beverages
    'milk', 'juice', 'tea', 'water', 'drink',
    
    // Dairy
    'milk', 'yogurt', 'cheese', 'cream', 'butter',
    
    // Original COCO labels
    'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl',
    'banana', 'apple', 'sandwich', 'orange', 'broccoli', 'carrot',
    'hot dog', 'pizza', 'donut', 'cake'
  ]);

  private readonly containerMapping = new Map([
    ['carton', ['milk', 'juice', 'cream']],
    ['bottle', ['tea', 'water', 'juice', 'soda']],
    ['container', ['yogurt', 'leftovers']],
    ['jar', ['sauce', 'jam', 'pickles']],
    ['package', ['cheese', 'meat', 'vegetables']]
  ]);

  private readonly defaultIngredients = [
    'milk', 'eggs', 'cheese', 'yogurt',
    'juice', 'water', 'soda',
    'lettuce', 'tomatoes', 'carrots',
    'apples', 'oranges',
    'chicken', 'beef',
    'butter', 'condiments'
  ];

  public getDefaultIngredients(): string[] {
    return this.defaultIngredients;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    if (this.isInitializing) {
      let waitTime = 0;
      const maxWaitTime = 30000; // 30 seconds max wait
      
      while (this.isInitializing && waitTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waitTime += 100;
      }
      
      if (waitTime >= maxWaitTime) {
        throw new Error('Model initialization timeout');
      }
      
      return;
    }

    this.isInitializing = true;

    try {
      await tf.ready();
      console.log('TensorFlow backend initialized:', tf.getBackend());

      this.model = await tf.loadGraphModel(
        'https://tfhub.dev/tensorflow/tfjs-model/ssd_mobilenet_v2/1/default/1',
        { fromTFHub: true }
      );

      // Warm up the model
      const dummyTensor = tf.zeros([1, 300, 300, 3]);
      await this.model.executeAsync(dummyTensor);
      dummyTensor.dispose();

      this.initialized = true;
      console.log('Model initialized successfully');
    } catch (error) {
      console.error('Error initializing model:', error);
      this.isInitializing = false;
      throw new Error(`Failed to initialize model: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.isInitializing = false;
    }
  }

  private processDetection(detection: Detection): string[] {
    const label = detection.label.toLowerCase();
    const ingredients = new Set<string>();
    
    // Direct food item
    if (this.foodLabels.has(label)) {
      ingredients.add(label);
    }
    
    // Check if it's a container and add likely contents
    if (this.containerMapping.has(label)) {
      const possibleContents = this.containerMapping.get(label) || [];
      possibleContents.forEach(item => ingredients.add(item));
    }
    
    return Array.from(ingredients);
  }

  async detectIngredients(imageBuffer: Buffer): Promise<DetectionResult> {
    let imageTensor: tf.Tensor4D | null = null;
    let predictions: tf.Tensor[] | null = null;

    try {
      if (!this.initialized) {
        await this.initialize();
      }

      imageTensor = await this.convertBufferToTensor(imageBuffer);
      predictions = await this.model.executeAsync(imageTensor) as tf.Tensor[];
      
      if (!predictions || !Array.isArray(predictions) || predictions.length < 4) {
        throw new Error('Invalid model output format');
      }

      const scoresTensor = predictions[1];
      const classesTensor = predictions[2];
      const validDetectionsTensor = predictions[3];
      
      const scores = await scoresTensor.data();
      const classes = await classesTensor.data();
      const validDetectionsData = await validDetectionsTensor.data();
      const numDetections = Math.trunc(validDetectionsData[0]);

      const detections: Detection[] = [];
      const allIngredients = new Set<string>();
      let isRefrigerator = false;

      // Process each detection
      for (let i = 0; i < numDetections; i++) {
        const score = scores[i];
        const classId = Math.round(classes[i]);
        
        if (score > this.confidenceThreshold) {
          const label = this.getLabel(classId);
          console.log(`Found object: ${label} with confidence ${score}`);
          
          // Clean up the label by removing common separators and extra text
          const cleanLabel = label.toLowerCase()
            .split(/[,()]/)  // Split on commas and parentheses
            .map(part => part.trim())  // Trim whitespace
            .filter(part => part.length > 0);  // Remove empty parts
          
          detections.push({ label, score });
          
          // Check each part of the label for refrigerator-related terms
          const isRefrigeratorItem = cleanLabel.some(part => 
            part === 'refrigerator' || 
            part === 'icebox' || 
            part === 'fridge'
          );
          
          if (isRefrigeratorItem) {
            console.log('Refrigerator detected in label:', label);
            isRefrigerator = true;
          }
          
          // Process for ingredients
          const ingredients = this.processDetection({ label, score });
          ingredients.forEach(ingredient => allIngredients.add(ingredient));
        }
      }
      
      // Log the final state
      console.log('Detection summary:', {
        isRefrigerator,
        ingredients: Array.from(allIngredients),
        detections: detections
      });
      
      return {
        ingredients: Array.from(allIngredients),
        isRefrigerator,
        rawDetections: detections
      };

    } catch (error) {
      console.error('Error in detectIngredients:', error);
      throw error;
    } finally {
      if (predictions && Array.isArray(predictions)) {
        predictions.forEach(tensor => {
          if (tensor instanceof tf.Tensor) {
            tensor.dispose();
          }
        });
      }
      if (imageTensor instanceof tf.Tensor) {
        imageTensor.dispose();
      }
    }
}


  private async convertBufferToTensor(buffer: Buffer): Promise<tf.Tensor4D> {
    let decoded: tf.Tensor | null = null;
    let expanded: tf.Tensor4D | null = null;  // Explicitly typed as Tensor4D

    try {
      // Validate buffer
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new Error('Invalid image buffer');
      }

      try {
        decoded = tfnode.node.decodeImage(buffer, 3) as tf.Tensor3D;
      } catch (decodeError) {
        console.error('Error decoding image:', decodeError);
        throw new Error('Failed to decode image. Please ensure the image format is supported (JPEG, PNG, or GIF).');
      }

      if (!decoded || decoded.shape.length !== 3) {
        throw new Error('Invalid image format');
      }

      try {
        const normalized = tf.div(decoded, 255.0) as tf.Tensor3D;
        const resized = tf.image.resizeBilinear(normalized, [300, 300]) as tf.Tensor3D;
        // Explicitly cast to Tensor4D
        expanded = tf.expandDims(resized, 0) as tf.Tensor4D;

        // Cleanup intermediate tensors
        tf.dispose([normalized, resized]);
        
        return expanded;  // Now TypeScript knows this is definitely a Tensor4D
      } catch (processingError) {
        console.error('Error processing image:', processingError);
        throw new Error('Failed to process image');
      }
    } catch (error) {
      // Using the base tf.Tensor type for disposal
      if (decoded) (decoded as tf.Tensor).dispose();
      if (expanded) (expanded as tf.Tensor).dispose();
      throw error;
    }
}

  private getLabel(classId: number): string {
    const cocoLabels = [
      'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus',
      'train', 'truck', 'boat', 'traffic light', 'fire hydrant',
      'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog',
      'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe',
      'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
      'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat',
      'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
      'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl',
      'banana', 'apple', 'sandwich', 'orange', 'broccoli', 'carrot',
      'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
      'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop',
      'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven',
      'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase',
      'scissors', 'teddy bear', 'hair drier', 'toothbrush'
    ];

    return cocoLabels[classId - 1] || 'unknown';
  }
}

// Create and export a singleton instance
const detector = new IngredientDetector();
export default detector;