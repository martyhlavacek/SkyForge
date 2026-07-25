import { describe, expect, it } from 'vitest';
import {
  analyzeRoutes,
  analyzeTerrainCombatPressure,
  distanceAtTime,
} from './TerrainAnalysis';
import type { RouteSetDef, TerrainCollisionDef } from '../../schemas/terrainSchema';

const collision: TerrainCollisionDef = {
  formatVersion: '2.0',
  id: 'c',
  mapId: 'm',
  contactDamage: 20,
  lethalContact: false,
  corridor: {
    id: 'main',
    blocksPlayerProjectiles: true,
    blocksEnemyProjectiles: true,
    samples: [
      { worldY: 0, left: 130, right: 410 },
      { worldY: 1000, left: 130, right: 410 },
    ],
  },
};
const routes: RouteSetDef = {
  formatVersion: '2.0',
  id: 'r',
  mapId: 'm',
  routes: [
    {
      id: 'route',
      name: 'Route',
      minimumRadius: 20,
      samples: [
        { worldY: 0, centerX: 270, clearance: 140 },
        { worldY: 1000, centerX: 270, clearance: 140 },
      ],
    },
  ],
};

describe('TerrainAnalysis', () => {
  it('measures route clearance', () => {
    expect(analyzeRoutes(collision, routes, 18)).toMatchObject({
      minimumWidth: 280,
      minimumClearance: 140,
      issues: [],
    });
  });

  it('integrates segmented scroll profiles', () => {
    expect(
      distanceAtTime(
        {
          baseScrollSpeed: 100,
          scrollProfile: [{ startTime: 0, endTime: 10, speed: 50 }],
        },
        12,
      ),
    ).toBe(600);
  });

  it('flags combat pressure in narrow terrain', () => {
    const issues = analyzeTerrainCombatPressure(
      { baseScrollSpeed: 100, events: [{ at: 8.4, encounter: 'hard' }] },
      collision,
      () => 5,
      840,
    );
    expect(issues[0]).toMatchObject({ severity: 'error', encounterId: 'hard' });
  });

  it('flags route shifts that exceed the available reaction time', () => {
    const fastShift = structuredClone(routes);
    fastShift.routes[0].samples = [
      { worldY: 0, centerX: 120, clearance: 120 },
      { worldY: 60, centerX: 420, clearance: 120 },
    ];
    const result = analyzeRoutes(collision, fastShift, 18, 18, {
      scrollSpeed: 120,
      maxLateralSpeed: 300,
      minimumReactionSeconds: 0.5,
    });
    expect(result.minimumReactionTime).toBeLessThan(0);
    expect(result.issues.some((issue) => issue.message.includes('only'))).toBe(true);
  });

});
