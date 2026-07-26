import type { StudioPackage } from '../schemas/studioPackageSchema';
import { packageTypeOf } from './PackageTypes';

export interface PackageSemanticIssue {
  path: string;
  message: string;
}

function duplicateIssues(path: string, ids: string[]): PackageSemanticIssue[] {
  const seen = new Set<string>();
  const duplicate = new Set<string>();
  ids.forEach((id) => (seen.has(id) ? duplicate.add(id) : seen.add(id)));
  return [...duplicate].map((id) => ({ path, message: `duplicate id "${id}"` }));
}

export function validateStudioPackageSemantics(
  pkg: StudioPackage,
): PackageSemanticIssue[] {
  const issues: PackageSemanticIssue[] = [];
  issues.push(
    ...duplicateIssues(
      'manifest.dependencies',
      pkg.manifest.dependencies.map(
        (dependency) => `${dependency.type}:${dependency.id}`,
      ),
    ),
  );
  issues.push(
    ...duplicateIssues(
      'reviewComments',
      pkg.reviewComments.map((comment) => comment.id),
    ),
  );

  switch (packageTypeOf(pkg)) {
    case 'level': {
      if (pkg.format !== 'skyforge-level-pack') break;
      const groups: [string, string[]][] = [
        ['payload.levels', pkg.payload.levels.map((item) => item.id)],
        ['payload.levelPackages', pkg.payload.levelPackages.map((item) => item.id)],
        ['payload.maps', pkg.payload.maps.map((item) => item.id)],
        ['payload.collisions', pkg.payload.collisions.map((item) => item.id)],
        ['payload.routes', pkg.payload.routes.map((item) => item.id)],
        ['payload.objects', pkg.payload.objects.map((item) => item.id)],
        ['payload.biomes', pkg.payload.biomes.map((item) => item.id)],
      ];
      groups.forEach(([path, ids]) => issues.push(...duplicateIssues(path, ids)));
      const levelIds = new Set(pkg.payload.levels.map((item) => item.id));
      const mapIds = new Set(pkg.payload.maps.map((item) => item.id));
      const collisionIds = new Set(pkg.payload.collisions.map((item) => item.id));
      const routeIds = new Set(pkg.payload.routes.map((item) => item.id));
      const objectIds = new Set(pkg.payload.objects.map((item) => item.id));
      const biomeIds = new Set(pkg.payload.biomes.map((item) => item.id));
      pkg.payload.levelPackages.forEach((item, index) => {
        const refs: [string, string, Set<string>][] = [
          ['levelId', item.levelId, levelIds],
          ['mapId', item.mapId, mapIds],
          ['collisionId', item.collisionId, collisionIds],
          ['routeSetId', item.routeSetId, routeIds],
          ['objectSetId', item.objectSetId, objectIds],
          ['biomeId', item.biomeId, biomeIds],
        ];
        refs.forEach(([field, id, valid]) => {
          if (!valid.has(id)) {
            issues.push({
              path: `payload.levelPackages[${index}].${field}`,
              message: `reference "${id}" is not included in this Level Pack`,
            });
          }
        });
      });
      pkg.payload.campaign?.levelOrder.forEach((id, index) => {
        if (!levelIds.has(id)) {
          issues.push({
            path: `payload.campaign.levelOrder[${index}]`,
            message: `level "${id}" is not included in this Level Pack`,
          });
        }
      });
      break;
    }
    case 'tuning': {
      if (pkg.format !== 'skyforge-tuning-pack') break;
      const groups: [string, string[]][] = [
        ['payload.enemies', pkg.payload.enemies.map((item) => item.id)],
        ['payload.weapons', pkg.payload.weapons.map((item) => item.id)],
        [
          'payload.projectilePatterns',
          pkg.payload.projectilePatterns.map((item) => item.id),
        ],
        ['payload.movementPatterns', pkg.payload.movementPatterns.map((item) => item.id)],
        ['payload.formations', pkg.payload.formations.map((item) => item.id)],
        ['payload.encounters', pkg.payload.encounters.map((item) => item.id)],
        ['payload.bosses', pkg.payload.bosses.map((item) => item.id)],
        ['payload.pickups', pkg.payload.pickups.map((item) => item.id)],
        ['payload.equipment', pkg.payload.equipment.map((item) => item.id)],
      ];
      groups.forEach(([path, ids]) => issues.push(...duplicateIssues(path, ids)));
      break;
    }
    case 'music': {
      if (pkg.format !== 'skyforge-music-pack') break;
      issues.push(
        ...duplicateIssues(
          'payload.cues',
          [
            ...pkg.payload.cues.map((item) => item.id),
            ...pkg.payload.tracks.map((item) => item.id),
          ],
        ),
      );
      issues.push(
        ...duplicateIssues(
          'payload.instruments',
          pkg.payload.instruments.map((item) => item.id),
        ),
      );
      issues.push(
        ...duplicateIssues(
          'payload.compositions',
          pkg.payload.compositions.map((item) => item.id),
        ),
      );
      issues.push(
        ...duplicateIssues(
          'resources',
          pkg.resources.map((item) => item.id),
        ),
      );
      const cueIds = new Set(pkg.payload.cues.map((item) => item.id));
      const resourceIds = new Set(pkg.resources.map((item) => item.id));
      const resourcesById = new Map(pkg.resources.map((item) => [item.id, item]));
      const resourceUris = new Set(pkg.resources.map((item) => item.uri));
      const instrumentIds = new Set(pkg.payload.instruments.map((item) => item.id));
      pkg.payload.compositions.forEach((composition, index) => {
        const base = `payload.compositions[${index}]`;
        if (!cueIds.has(composition.cueId)) {
          issues.push({
            path: `${base}.cueId`,
            message: `cue "${composition.cueId}" is not included in this Music Pack`,
          });
        }
        issues.push(
          ...duplicateIssues(
            `${base}.channels`,
            composition.channels.map((item) => item.id),
          ),
          ...duplicateIssues(
            `${base}.patterns`,
            composition.patterns.map((item) => item.id),
          ),
        );
        const patternIds = new Set(composition.patterns.map((item) => item.id));
        composition.order.forEach((patternId, orderIndex) => {
          if (!patternIds.has(patternId)) {
            issues.push({
              path: `${base}.order[${orderIndex}]`,
              message: `pattern "${patternId}" is not included in this composition`,
            });
          }
        });
        if (composition.loopStartOrder > composition.order.length) {
          issues.push({
            path: `${base}.loopStartOrder`,
            message: 'loop start exceeds order length',
          });
        }
        if (composition.loopEndOrder > composition.order.length) {
          issues.push({
            path: `${base}.loopEndOrder`,
            message: 'loop end exceeds order length',
          });
        }
        if (
          composition.loopEndOrder > 0 &&
          composition.loopEndOrder <= composition.loopStartOrder
        ) {
          issues.push({
            path: `${base}.loopEndOrder`,
            message: 'loop end must be greater than loop start',
          });
        }
        composition.channels.forEach((channel, channelIndex) => {
          if (
            channel.defaultInstrumentId &&
            !instrumentIds.has(channel.defaultInstrumentId)
          ) {
            issues.push({
              path: `${base}.channels[${channelIndex}].defaultInstrumentId`,
              message: `instrument "${channel.defaultInstrumentId}" is not included`,
            });
          }
        });
        composition.patterns.forEach((pattern, patternIndex) => {
          pattern.rows.forEach((event, eventIndex) => {
            const eventPath = `${base}.patterns[${patternIndex}].rows[${eventIndex}]`;
            if (event.row >= pattern.lengthRows) {
              issues.push({
                path: `${eventPath}.row`,
                message: `row ${event.row} exceeds pattern length ${pattern.lengthRows}`,
              });
            }
            if (event.channel >= composition.channels.length) {
              issues.push({
                path: `${eventPath}.channel`,
                message: `channel ${event.channel} does not exist`,
              });
            }
            if (event.instrumentId && !instrumentIds.has(event.instrumentId)) {
              issues.push({
                path: `${eventPath}.instrumentId`,
                message: `instrument "${event.instrumentId}" is not included`,
              });
            }
          });
        });
      });
      pkg.payload.instruments.forEach((instrument, index) => {
        if (instrument.kind === 'sample' && !resourceIds.has(instrument.resourceId)) {
          issues.push({
            path: `payload.instruments[${index}].resourceId`,
            message: `resource "${instrument.resourceId}" is not declared`,
          });
        }
      });
      pkg.payload.tracks.forEach((track, index) => {
        const expectedId = `music-${track.sha256.slice(0, 24)}`;
        if (track.id !== expectedId) {
          issues.push({
            path: `payload.tracks[${index}].id`,
            message: `track ID must use SHA-256 content identity "${expectedId}"`,
          });
        }
        const expectedPath = `assets/audio/music/${track.id}.mp3`;
        if (track.relativePath !== expectedPath) {
          issues.push({
            path: `payload.tracks[${index}].relativePath`,
            message: `track path must be the canonical path "${expectedPath}"`,
          });
        }
        const resource = resourcesById.get(track.resourceId);
        if (!resource) {
          issues.push({
            path: `payload.tracks[${index}].resourceId`,
            message: `resource "${track.resourceId}" is not declared`,
          });
          return;
        }
        if (resource.mediaType !== 'audio/mpeg') {
          issues.push({
            path: `payload.tracks[${index}].resourceId`,
            message: `resource "${track.resourceId}" is not an audio/mpeg resource`,
          });
        }
        if (resource.sha256 && resource.sha256 !== track.sha256) {
          issues.push({
            path: `payload.tracks[${index}].sha256`,
            message: `track SHA-256 differs from resource "${track.resourceId}"`,
          });
        }
        if (resource.bytes !== undefined && resource.bytes !== track.byteLength) {
          issues.push({
            path: `payload.tracks[${index}].byteLength`,
            message: `track byte length differs from resource "${track.resourceId}"`,
          });
        }
      });
      pkg.payload.cues.forEach((cue, index) => {
        [cue.fullMix, ...cue.stems.map((stem) => stem.asset)]
          .filter((uri): uri is string => Boolean(uri))
          .forEach((uri) => {
            if (!resourceUris.has(uri)) {
              issues.push({
                path: `payload.cues[${index}]`,
                message: `audio resource "${uri}" is not declared in the package manifest`,
              });
            }
          });
        Object.entries(cue.transitions).forEach(([name, target]) => {
          if (target && !cueIds.has(target)) {
            issues.push({
              path: `payload.cues[${index}].transitions.${name}`,
              message: `cue "${target}" is not included in this Music Pack`,
            });
          }
        });
      });
      break;
    }
    case 'asset': {
      if (pkg.format !== 'skyforge-asset-pack') break;
      issues.push(
        ...duplicateIssues(
          'payload.assets',
          pkg.payload.assets.map((item) => item.id),
        ),
      );
      issues.push(
        ...duplicateIssues(
          'payload.tilesets',
          pkg.payload.tilesets.map((item) => item.id),
        ),
      );
      issues.push(
        ...duplicateIssues(
          'payload.atlases',
          pkg.payload.atlases.map((item) => item.id),
        ),
      );
      issues.push(
        ...duplicateIssues(
          'resources',
          pkg.resources.map((item) => item.id),
        ),
      );
      const assetIds = new Set(pkg.payload.assets.map((item) => item.id));
      const resourceIds = new Set(pkg.resources.map((item) => item.id));
      const resources = new Map(pkg.resources.map((item) => [item.id, item]));
      pkg.resources.forEach((resource, index) => {
        if (resource.embeddedData && (!resource.sha256 || resource.bytes === undefined)) {
          issues.push({
            path: `resources[${index}]`,
            message: 'embedded resources require SHA-256 and byte count metadata',
          });
        }
        if (
          resource.embeddedData &&
          !['image/png', 'image/webp', 'image/jpeg'].includes(resource.mediaType)
        ) {
          issues.push({
            path: `resources[${index}].mediaType`,
            message: 'embedded Asset Studio resources must be PNG, WebP, or JPEG',
          });
        }
      });
      pkg.payload.assets.forEach((asset, index) => {
        const resource = asset.resourceId ? resources.get(asset.resourceId) : undefined;
        if (asset.resourceId && !resource) {
          issues.push({
            path: `payload.assets[${index}].resourceId`,
            message: `resource "${asset.resourceId}" is not declared`,
          });
        }
        if (
          asset.presentation.shadowAssetId &&
          !assetIds.has(asset.presentation.shadowAssetId)
        ) {
          issues.push({
            path: `payload.assets[${index}].presentation.shadowAssetId`,
            message: `shadow asset "${asset.presentation.shadowAssetId}" is not included`,
          });
        }
        asset.frames.forEach((frame, frameIndex) => {
          const width = resource?.width ?? asset.width;
          const height = resource?.height ?? asset.height;
          if (frame.x + frame.width > width || frame.y + frame.height > height) {
            issues.push({
              path: `payload.assets[${index}].frames[${frameIndex}]`,
              message: `frame exceeds source dimensions ${width}x${height}`,
            });
          }
        });
        Object.entries(asset.animations).forEach(([name, animation]) => {
          animation.frames.forEach((frameIndex) => {
            if (asset.frames.length > 0 && frameIndex >= asset.frames.length) {
              issues.push({
                path: `payload.assets[${index}].animations.${name}`,
                message: `frame index ${frameIndex} does not exist`,
              });
            }
          });
        });
      });

      pkg.payload.tilesets.forEach((tileset, index) => {
        if (tileset.resourceId && !resourceIds.has(tileset.resourceId)) {
          issues.push({
            path: `payload.tilesets[${index}].resourceId`,
            message: `resource "${tileset.resourceId}" is not declared`,
          });
        }
        Object.entries(tileset.autotileMappings).forEach(([mask, tileIndex]) => {
          if (tileIndex >= tileset.columns * tileset.rows) {
            issues.push({
              path: `payload.tilesets[${index}].autotileMappings.${mask}`,
              message: `tile index ${tileIndex} exceeds the ${tileset.columns * tileset.rows} tile sheet`,
            });
          }
        });
      });
      pkg.payload.atlases.forEach((atlas, index) => {
        if (!resourceIds.has(atlas.resourceId)) {
          issues.push({
            path: `payload.atlases[${index}].resourceId`,
            message: `atlas resource "${atlas.resourceId}" is not declared`,
          });
        }
        atlas.frames.forEach((frame, frameIndex) => {
          if (!assetIds.has(frame.assetId)) {
            issues.push({
              path: `payload.atlases[${index}].frames[${frameIndex}].assetId`,
              message: `asset "${frame.assetId}" is not included`,
            });
          }
          if (
            frame.x + frame.width > atlas.width ||
            frame.y + frame.height > atlas.height
          ) {
            issues.push({
              path: `payload.atlases[${index}].frames[${frameIndex}]`,
              message: 'atlas frame exceeds atlas dimensions',
            });
          }
        });
      });
      break;
    }
  }
  return issues;
}
