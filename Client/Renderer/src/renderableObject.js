define(['core/src/spriteSheet', 'text!../content/objects.json'], function (SpriteSheet, ObjectData)
{
    'use strict';

    var objectData = JSON.parse(ObjectData);

    function RenderableObject(object)
    {
        this.object = object;

        var size, path;
        if (this.object.size === 'small')
        {
            size = {tileWidth: 70, tileHeight: 70};
            path = 'renderer/content/images/objects-small.png';
        }
        else if (this.object.size === 'medium')
        {
            size = {tileWidth: 96, tileHeight: 96};
            path = 'renderer/content/images/objects-medium.png';
        }
        else
        {
            size = {tileWidth: 128, tileHeight: 128};
            path = 'renderer/content/images/objects-large.png';
        }

        var offsets = objectData[this.object.size];
        this.verticalOffset = (offsets && offsets[this.object.style]) || 0;

        this.spriteSheet = new SpriteSheet(this.object.size, path, size);
        this.spriteSheet.setCurrentTile(object.style);
    }

    RenderableObject.prototype.getImageIndex = function ()
    {
        return this.spriteSheet.image.globalIndex;
    };

    RenderableObject.prototype.getTileRight = function ()
    {
        return this.object.x + this.object.sizeX;
    };

    RenderableObject.prototype.getTileBottom = function ()
    {
        return this.object.y + this.object.sizeY;
    };

    RenderableObject.prototype.render = function (context, deltaTime, camera)
    {
        if (!this.spriteSheet.isLoaded())
            return;

        var tileRect = this.spriteSheet.getCurrentTileBounds();
        if (tileRect)
        {
            var position = camera.tileToScreen(this.object.x, this.object.y);

            var tileHeight = this.object.sizeY * camera.tileHeight;
            var imageWidth = this.spriteSheet.tileWidth * camera.scale;
            var imageHeight = this.spriteSheet.tileHeight * camera.scale;

            var left = position.x - camera.viewportRect.x + camera.halfTileWidth - (imageWidth / 2);
            var top = position.y - camera.viewportRect.y + tileHeight - this.verticalOffset - imageHeight;

            if (camera.isInView(left, top, imageWidth, imageHeight))
            {
                context.drawImage(this.spriteSheet.image.data, tileRect.x, tileRect.y, tileRect.width, tileRect.height,
                    left, top, imageWidth, imageHeight);
            }
        }
    };

    return RenderableObject;
});
