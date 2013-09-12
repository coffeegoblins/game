define(function ()
{
    'use strict';

    function RenderableObject(object)
    {
        this.object = object;
    }

    RenderableObject.prototype.isVisible = function (left, right, top, bottom)
    {
        return  this.object.tileX <= right &&
                this.object.tileY <= bottom &&
                this.object.tileX + this.object.sizeX >= left &&
                this.object.tileY + this.object.sizeY >= top;
    };

    RenderableObject.prototype.render = function (context, tileSize, viewportRect)
    {
        var scaledWidth = tileSize * this.object.sizeX;
        var scaledHeight = tileSize * this.object.sizeY;

        var width = Math.floor(scaledWidth * 0.75);
        var height = Math.floor(scaledHeight * 0.75);

        var horizontalOffset = 1 + ((scaledWidth - width) / 2);
        var verticalOffset = 1 + ((scaledHeight - height) / 2);

        var xPosition = this.object.tileX * tileSize + horizontalOffset - viewportRect.x;
        var yPosition = this.object.tileY * tileSize + verticalOffset - viewportRect.y;

        context.beginPath();
        context.fillStyle = '#000';
        context.rect(xPosition, yPosition, width, height);
        context.fill();
    };

    return RenderableObject;
});