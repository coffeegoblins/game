define(['./events'], function (Events)
{
    'use strict';


    function Map(tiles, boundaries)
    {
        this.tiles = tiles;
        this.width = boundaries.width;
        this.height = boundaries.height;
    }

    Map.prototype.addObject = function (object, x, y)
    {
        object.x = x;
        object.y = y;

        for (var x = x; x < x + object.sizeX; x++)
        {
            for (var y = y; y < y + object.sizeY; y++)
            {
                var tile = this.getTile(x, y);
                if (tile)
                {
                    tile.content = object;
                }
            }
        }
    };

    Map.prototype.addUnit = function (unit, x, y)
    {
        var tile = this.getTile(x, y);

        unit.x = x;
        unit.y = y;

        tile.unit = unit;
        unit.on('death', this, this.removeUnit);
    };

    Map.prototype.canMoveToTile = function (unit, x, y)
    {
        var tile = this.getTile(x, y);
        if (!tile || tile.unit)
            return false;

        if (tile.content)
        {
            if (!tile.content.isClimbable || !unit.canClimbObjects)
                return false;
        }

        return true;
    };

    Map.prototype.isTraversable = function (tile)
    {
        return !this.collisionTiles[tile.spriteIndex];
    };

    Map.prototype.onClick = function (e, x, y)
    {
        var tile = this.getTile(x, y);
        this.trigger('tileClick', tile, x, y);
    };

    Map.prototype.getTile = function (x, y)
    {
        if (x < 0 || y < 0 || x > this.width - 1 || y > this.height - 1)
            return;

        return this.tiles[x + y * this.width];
    };

    Map.prototype.removeObject = function (object)
    {
        for (var x = object.x; x < object.x + object.sizeX; x++)
        {
            for (var y = object.y; y < object.y + object.sizeY; y++)
            {
                var tile = this.getTile(x, y);
                if (tile && tile.content === object)
                    tile.content = null;
            }
        }
    };

    Map.prototype.removeUnit = function (unit)
    {
        var tile = this.getTile(unit.x, unit.y);
        tile.unit = null;
    };

    Events.register(Map.prototype);
    return Map;
});
