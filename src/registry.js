// Registro de alimentos y API pública (REQ-API-001, REQ-EXT-001).
import { FoodSimulator } from './core/simulator.js';
import { riceFood } from './food/rice.js';
export function createFoodSimulator() { return new FoodSimulator().registerFood(riceFood); }
