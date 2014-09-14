define(['./map', './worldObject'], function (Map, WorldObject)
{
    'use strict';

    function LevelLoader(jsonLoader)
    {
        this.jsonLoader = jsonLoader;

        // TODO: What's the best way to store and associate this data?
        this.collisionTiles = {
            terrain: {},
            terrain2: {
                29: true
            }
        };

        for (var i = 17; i <= 32; i++)
        {
            this.collisionTiles.terrain[i] = true;
        }
    }

    LevelLoader.prototype.loadLevel = function (fileName, onComplete)
    {
        var self = this;
        this.jsonLoader.loadLevel(fileName, function (levelData)
        {
            self.onLevelLoaded(levelData, onComplete);
        });
    };

    LevelLoader.prototype.onLevelLoaded = function (levelData, onComplete)
    {
        var width = 0;
        var height = 0;

        var layer;
        for (var layerName in levelData.layers)
        {
            layer = levelData.layers[layerName];
            if (layer.type === 'tileLayer')
            {
                var rect = layer.properties.rect;
                width = Math.max(width, rect.x + rect.width);
                height = Math.max(height, rect.y + rect.height);
            }
        }

        var data = {
            map: new Map(levelData.prototypes.tiles, levelData.boundaries),
            objects: [],
            player1Positions: [],
            player2Positions: []
        };


        for (layerName in levelData.layers)
        {
            layer = levelData.layers[layerName];
            if (layer.type === 'objectLayer')
            {
                this.loadObjects(layer, data);
            }
            else if (layerName === 'background')
            {
                data.map.spriteSheet = layer.spriteSheet;
                data.map.collisionTiles = this.collisionTiles[layer.spriteSheet];
            }
            else if (layerName === 'heights')
            {
                this.loadTiles(layer, data.map, 'height');
            }
        }

        onComplete(data);
    };

    LevelLoader.prototype.loadObjects = function (layer, data)
    {
        for (var i = 0; i < layer.objects.length; i++)
        {
            data.objects.push(new WorldObject(layer.objects[i]));
        }
    };

    LevelLoader.prototype.loadTiles = function (layer, map, property)
    {
        for (var i = 0; i < layer.tiles.length; i++)
        {
            var rect = layer.properties.rect;
            var x = rect.x + (i % rect.width);
            var y = rect.y + Math.floor(i / rect.width);

            var tile = map.getTile(x, y);
            if (tile)
            {
                tile[property] = layer.tiles[i];
            }
        }
    };

    return LevelLoader;
});
