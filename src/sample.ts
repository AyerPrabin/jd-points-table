import { MISSING, PENDING, played } from './scoring';
import type { EventState } from './storage';

/**
 * Made-up squads for trying the app. Match 3 is half entered and one squad's
 * result is missing, which is what happened to me at a real event.
 */
export function sampleEvent(): EventState {
  const squads: [string, ReturnType<typeof played>[]][] = [
    ['Night Owls', [played(1, 9), played(3, 4), played(2, 6)]],
    ['Squad A', [played(2, 5), played(1, 8), MISSING]],
    ['Red Kites', [played(3, 3), played(2, 6), played(1, 7)]],
    ['Iron Wolves', [played(4, 6), played(5, 2), played(3, 3)]],
    ['Blue Comets', [played(5, 1), played(4, 3), played(4, 2)]],
    ['Silent Foxes', [played(6, 2), played(8, 0), PENDING]],
    ['Storm Riders', [played(7, 4), played(6, 1), PENDING]],
    ['Squad B', [played(8, 0), played(7, 2), PENDING]],
  ];
  return {
    title: 'Friday Night Scrim',
    squads: squads.map(([name, results], i) => ({
      id: `sample-${i + 1}`,
      name,
      results,
    })),
  };
}
