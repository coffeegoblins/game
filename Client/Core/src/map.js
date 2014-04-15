define(['./events'], function (Events)
{
    'use strict';


    function Map(width, height)
    {
        this.tiles = [];
        this.width = width;
        this.height = height;

        for (var y = 0; y < height; y++)
        {
            for (var x = 0; x < width; x++)
                this.tiles.push({height: 0});
        }
    }

    Map.prototype.addObject = function (object, x, y)
    {
        object.tileX = x;
        object.tileY = y;

        for (var tileX = x; tileX < x + object.sizeX; tileX++)
        {
            for (var tileY = y; tileY < y + object.sizeY; tileY++)
            {
                var tile = this.getTile(tileX, tileY);
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

        unit.tileX = x;
        unit.tileY = y;

        tile.unit = unit;
        unit.on('death', this, this.removeUnit);
    };

    Map.prototype.canMoveToTile = function (unit, tileX, tileY)
    {
        var tile = this.getTile(tileX, tileY);
        if (!tile || tile.unit)
            return false;

        if (tile.content)
        {
            if (!tile.content.isClimbable || !unit.canClimbObjects)
                return false;
        }

        return true;
    };

    Map.prototype.onClick = function (e, x, y, soldier)
    {
        var tile;
        if (soldier)
            tile = this.getTile(soldier.tileX, soldier.tileY);
        else
            tile = this.getTile(x, y);

        this.trigger('tileClick', tile, x, y, soldier);
    };

    Map.prototype.getTile = function (x, y)
    {
        if (x < 0 || y < 0 || x > this.width - 1 || y > this.height - 1)
            return;

        return this.tiles[x + y * this.width];
    };

    Map.prototype.removeObject = function (object)
    {
        for (var tileX = object.tileX; tileX < object.tileX + object.sizeX; tileX++)
        {
            for (var tileY = object.tileY; tileY < object.tileY + object.sizeY; tileY++)
            {
                var tile = this.getTile(tileX, tileY);
                if (tile && tile.content === object)
                    tile.content = null;
            }
        }
    };

    Map.prototype.removeUnit = function (unit)
    {
        var tile = this.getTile(unit.tileX, unit.tileY);
        tile.unit = null;
    };

    Events.register(Map.prototype);
    return Map;
});
