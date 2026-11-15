// Scoring rules used on JD Esports Arena squad events.
// Change them here and nowhere else.

/** Number of matches in one event. */
export const MATCH_COUNT = 3;

/**
 * Placement points, where index 0 is 1st place.
 * 11th place and below get 0.
 */
export const PLACEMENT_POINTS: readonly number[] = [12, 9, 8, 7, 6, 5, 4, 3, 2, 1];

/** Points for each kill. */
export const POINTS_PER_KILL = 1;

/** A Free Fire squad room holds 12 squads (48 players), but I allow some slack. */
export const MAX_SQUADS = 25;

export const MAX_SQUAD_NAME_LENGTH = 24;
