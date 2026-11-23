export { FoodSimulator, ENGINE_VERSION } from './core/simulator.js';
export { createFoodSimulator } from './registry.js';
export { ValidationError, validateSimulationInput } from './core/validation.js';
export { riceFood, registerMaterial, MATERIALS, RICE_TYPES, RICE_PARAMS } from './food/rice.js';
export { classifyRice, CLASS_PARAMS } from './food/classifier.js';
export { SCENARIOS } from './food/scenarios.js';
export { createSimClient } from './worker/sim-client.js';
