import { MODULE_SCOPE, TOP_KEY, BOTTOM_KEY } from "./const.js";

export function getWallBounds(wall) {
    if(wall.document) wall = wall.document;
    const top = wall.getFlag(MODULE_SCOPE, TOP_KEY) ?? Infinity;
    const bottom = wall.getFlag(MODULE_SCOPE, BOTTOM_KEY) ?? -Infinity;
    return { top, bottom }
}

export function getSceneSettings(scene) {
    let advancedVision = scene.getFlag(MODULE_SCOPE,"advancedVision") ?? true;
    return {advancedVision};
}

export async function _old_migrateData(scene){
    if(!scene) scene = canvas.scene;
    const walls = Array.from(scene.walls);
    const updates = [];
    for (const wall of walls) {
        const oldTop = wall.data.flags?.wallHeight?.wallHeightTop;
        const oldBottom = wall.data.flags?.wallHeight?.wallHeightBottom;
        if ((oldTop !== null && oldTop !== undefined) || (oldBottom !== null && oldBottom !== undefined)) {
            const update = {
              _id: wall.id,
              flags: {
                "wall-height": {
                  top: oldTop,
                  bottom: oldBottom,
                },
                "-=wallHeight": null
              },
            };
            updates.push(update);
        }
    }
    if(updates.length <= 0) return false;
    await scene.updateEmbeddedDocuments("Wall", updates);
    console.log("Wall Height - Migrated " + updates.length + " walls to new Wall Height data structure in scene " + scene.name);
    return true;

}

export async function migrateData(scene){
  if(!scene) scene = canvas.scene;
  const walls = Array.from(scene.walls);
  const updates = [];
  for (const wall of walls) {
      const oldTop = wall.data.flags?.wallHeight?.wallHeightTop;
      const oldBottom = wall.data.flags?.wallHeight?.wallHeightBottom;
      if ((oldTop !== null && oldTop !== undefined) || (oldBottom !== null && oldBottom !== undefined)) {
          const update = {
            _id: wall.id,
            flags: {
              "wall-height": {
                top: oldTop,
                bottom: oldBottom,
              },
              "-=wallHeight": null
            },
          };
    if(wall.data.flags['token-attacher']){
      const oldOffsetTop = wall.data.flags?.['token-attacher']?.offset?.elevation?.flags?.wallHeight?.wallHeightTop;
      const oldOffsetBottom = wall.data.flags?.['token-attacher']?.offset?.elevation?.flags?.wallHeight?.wallHeightBottom;
      if ((oldTop !== null && oldTop !== undefined) || (oldBottom !== null && oldBottom !== undefined)) {
        setProperty(update, `flags.token-attacher.offset.elevation.flags.wall-height`,{
          top: oldOffsetTop,
          bottom: oldOffsetBottom
        });
        setProperty(update, `flags.token-attacher.offset.elevation.flags.-=wallHeight`, null);
      }
    }
    updates.push(update);
      }
  }
  if(updates.length <= 0) return false;
  await scene.updateEmbeddedDocuments("Wall", updates,{'token-attacher': {update:true}});
  ui.notifications.notify("Wall Height - Migrated " + updates.length + " walls to new Wall Height data structure in scene " + scene.name);
  console.log("Wall Height - Migrated " + updates.length + " walls to new Wall Height data structure in scene " + scene.name);
  return true;
}