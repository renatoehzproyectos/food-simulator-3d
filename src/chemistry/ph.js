// @ts-check
/** Modulación de k por pH: k·10^(slope·(pH_ref − pH)). slope=0 → sin efecto. (Estado de pH: constante por región, inicialmente.) */
export const pHFactor = (pH, { pH_ref = 6.5, slope = 0 } = {}) => 10 ** (slope * (pH_ref - pH));
