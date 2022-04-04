import { getWallBounds,getSceneSettings,migrateData,getLevelsBounds,getAdvancedLighting } from "./utils.js";

const MODULE_ID = "wall-height";

class WallHeightUtils{
  constructor(){
    this._advancedVision = null;
    this._currentTokenElevation = null;
    this.isLevels = game.modules.get("levels")?.active;
  }

  set currentTokenElevation(elevation) {
    let update = false;
    const { advancedVision } = getSceneSettings(canvas.scene);
    if (this._currentTokenElevation !== elevation) {
      this._currentTokenElevation = elevation;
      if (advancedVision) {
        update = true;
      }
    }
    if (this._advancedVision !== !!advancedVision) {
      this._advancedVision = !!advancedVision;
      update = true;
    }
    if (update) {
      this.schedulePerceptionUpdate();
    }
  }

  get currentTokenElevation(){
    return this._currentTokenElevation;
  }

  schedulePerceptionUpdate(){
    canvas.perception.schedule({
      lighting: { initialize: true, refresh: true },
      sight: { initialize: true, refresh: true, forceUpdateFog: true },
      sounds: { initialize: true, refresh: true },
      foreground: { refresh: true }
    });
  }

  updateCurrentTokenElevation() {
    const token = canvas.tokens.controlled[0];
    if (!token && game.user.isGM) {
      this.currentTokenElevation = null;
    } else if (token) {
      this.currentTokenElevation =
        WallHeight.isLevels && _levels?.advancedLOS
          ? _levels.getTokenLOSheight(token)
          : token.data.elevation;
    }
  }

  async setSourceElevationTop(document, value) {
    if (document instanceof TokenDocument) return;
    return await document.update({ "flags.levels.rangeTop": value });
  }

  getSourceElevationTop(document) {
    if (document instanceof TokenDocument) return WallHeight.isLevels && _levels?.advancedLOS && document.object
      ? _levels.getTokenLOSheight(document.object)
      : document.data.elevation;
    return document.data.flags?.levels?.rangeTop ?? +Infinity;
  }

  async setSourceElevationBottom(document, value) {
    if (document instanceof TokenDocument) return await document.update({ "elevation": bottom });
    return await document.update({ "flags.levels.rangeBottom": value });
  }

  getSourceElevationBottom(document) {
    if (document instanceof TokenDocument) return document.data.elevation;
    return document.data.flags?.levels?.rangeBottom ?? -Infinity;
  }

  async setSourceElevationBounds(document, bottom, top) {
    if (document instanceof TokenDocument) return await document.update({ "elevation": bottom });
    return await document.update({ "flags.levels.rangeBottom": bottom, "flags.levels.rangeTop": top });
  }

  getSourceElevationBounds(document) {
    if (document instanceof TokenDocument) {
      const bottom = document.data.elevation;
      const top = WallHeight.isLevels && _levels?.advancedLOS && document.object
        ? _levels.getTokenLOSheight(document.object)
        : bottom;
      return { bottom, top };
    }
    return getLevelsBounds(document);
  }

  async migrateData(scene){
    return await migrateData(scene);
  }

  async migrateCompendiums (){
      let migratedScenes = 0;
      const compendiums = Array.from(game.packs).filter(p => p.documentName === 'Scene');
      for (const compendium of compendiums) {
        const scenes = await compendium.getDocuments();
        for(const scene of scenes){
          const migrated = await migrateData(scene);
          if(migrated) migratedScenes++;
        }
      }
      if(migratedScenes > 0){
          ui.notifications.notify(`Wall Height - Migrated ${migratedScenes} scenes to new Wall Height data structure.`);
          console.log(`Wall Height - Migrated ${migratedScenes} scenes to new Wall Height data structure.`);
      }else{
          ui.notifications.notify(`Wall Height - No scenes to migrate.`);
          console.log(`Wall Height - No scenes to migrate.`);
      }
      return migratedScenes;
  }

  async migrateScenes (){
      const scenes = Array.from(game.scenes);
      let migratedScenes = 0;
      ui.notifications.warn("Wall Height - Migrating all scenes, do not refresh the page!");
      for(const scene of scenes){
        const migrated = await migrateData(scene);
        if(migrated) migratedScenes++;
      }
      if(migratedScenes > 0){
        ui.notifications.notify(`Wall Height - Migrated ${migratedScenes} scenes to new Wall Height data structure.`);
        console.log(`Wall Height - Migrated ${migratedScenes} scenes to new Wall Height data structure.`);
      }else{
          ui.notifications.notify(`Wall Height - No scenes to migrate.`);
          console.log(`Wall Height - No scenes to migrate.`);
      }
      return migratedScenes;
  }

  async migrateAll(){
      ui.notifications.error(`Wall Height - WARNING: The new data structure requires Better Roofs, Levels and 3D Canvas and Token Attacher to be updated!`);
      await WallHeight.migrateScenes();
      await WallHeight.migrateCompendiums();
      ui.notifications.notify(`Wall Height - Migration Complete.`);
      await game.settings.set(MODULE_ID, 'migrateOnStartup', false);
  }

  getWallBounds(wall){
    return getWallBounds(wall);
  }
}

export function registerWrappers() {
  globalThis.WallHeight = new WallHeightUtils();

  function tokenOnUpdate(wrapped, ...args) {
    wrapped(...args);

    const { advancedVision } = getSceneSettings(this.scene);
    const bottom = this.data.elevation;
    const top = WallHeight.isLevels && _levels?.advancedLOS
      ? _levels.getTokenLOSheight(this)
      : bottom;
    if (!advancedVision) {
      if (canvas.sight.sources.has(this.sourceId)) {
        this.vision.los.origin.b = bottom;
        this.vision.los.origin.t = top;
      }
      if (canvas.lighting.sources.has(this.sourceId)) {
        this.light.los.origin.b = bottom;
        this.light.los.origin.t = top;
      }
    } else if (canvas.sight.sources.has(this.sourceId) && (this.vision.los.origin.b !== bottom || this.vision.los.origin.t !== top)
      || canvas.lighting.sources.has(this.sourceId) && (this.light.los.origin.b !== bottom || this.light.los.origin.t !== top)) {
      this.updateSource({ defer: true });
      canvas.perception.schedule({
        lighting: { refresh: true },
        sight: { refresh: true, forceUpdateFog: true },
        sounds: { refresh: true },
        foreground: { refresh: true }
      });
    }
  }

  function testWallHeight(wall, origin, type) {
    const { advancedVision } = getSceneSettings(wall.scene);
    if (!advancedVision) return true;
    const { top, bottom } = getWallBounds(wall);
    return origin.b >= bottom && !(origin.t - top >= 0);
  }

  function testWallInclusion(wrapped, ...args){
    return wrapped(...args) && testWallHeight(args[0], args[1], args[2]);
  }

  function isDoorVisible(wrapped, ...args) {
    const wall = this.wall;
    const { advancedVision } = getSceneSettings(wall.scene);
    const elevation = WallHeight.currentTokenElevation;
    if (elevation == null || !advancedVision) return wrapped(...args);
    const { top, bottom } = getWallBounds(wall);
    if (!(elevation >= bottom && !(elevation - top >= 0))) return false;
    return wrapped(...args);
  }

  function setSourceElevation(wrapped, origin, config = {}, ...args) {
    let bottom = -Infinity;
    let top = +Infinity;
    if (origin.b == undefined && origin.t == undefined) {
      const object = config.source?.object;
      if (object instanceof Token) {
        bottom = object.data.elevation;
        top = WallHeight.isLevels && _levels?.advancedLOS
          ? _levels.getTokenLOSheight(object)
          : bottom;
      } else if (object instanceof AmbientLight || object instanceof AmbientSound) {
        if (getAdvancedLighting(object.document)) {
          const bounds = getLevelsBounds(object.document)//WallHeight.getElevation(object.document);
          bottom = bounds.bottom;
          top = bounds.top;
        } else {
          bottom = WallHeight.currentTokenElevation;
          if (bottom == null) {
            bottom = -Infinity;
            top = +Infinity;
          } else {
            top = bottom;
          }
        }
      }
    }
    origin.b = origin.b ?? bottom;
    origin.t = origin.t ?? top;
    return wrapped(origin, config, ...args);
  }

  Hooks.on("updateToken", () => {
    WallHeight.updateCurrentTokenElevation();
  });

  Hooks.on("controlToken", () => {
    WallHeight.updateCurrentTokenElevation();
  });

  Hooks.on("updateScene", (doc, change) => {
    WallHeight.updateCurrentTokenElevation();
  });

  Hooks.on("canvasInit", () => {
    WallHeight._advancedVision = null;
    WallHeight._currentTokenElevation = null;
  });

  Hooks.on("canvasReady", () => {
    WallHeight.updateCurrentTokenElevation();
  });

  libWrapper.register(MODULE_ID, "DoorControl.prototype.isVisible", isDoorVisible, "MIXED");

  libWrapper.register(MODULE_ID, "Token.prototype._onUpdate", tokenOnUpdate, "WRAPPER");

  libWrapper.register(MODULE_ID, "ClockwiseSweepPolygon.testWallInclusion", testWallInclusion, "WRAPPER");

  libWrapper.register(MODULE_ID, "ClockwiseSweepPolygon.prototype.initialize", setSourceElevation, "WRAPPER");
}
