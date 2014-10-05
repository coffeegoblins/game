define(['core/src/imageCache', 'renderer/src/renderableObject'], function (ImageCache, RenderableObject)
{
    'use strict';
    function RenderableLadder(ladder)
    {
        RenderableObject.call(this, ladder);
        this.image = ImageCache.setImage('ladder', 'renderer/content/images/ladder.png');
    }

    RenderableLadder.prototype = Object.create(RenderableObject.prototype);
    RenderableLadder.prototype.constructor = RenderableLadder;

    RenderableLadder.prototype.render = function (context, deltaTime, tileSize, viewportRect)
    {
        if (this.image.isLoaded)
        {
            var verticalOffset, horizontalOffset, rotation;
            switch (this.object.direction)
            {
                case 'left':
                    rotation = -Math.PI / 2;
                    horizontalOffset = tileSize * 0.125;
                    verticalOffset = tileSize * 0.5;
                    break;

                case 'right':
                    rotation = Math.PI / 2;
                    horizontalOffset = tileSize * 0.875;
                    verticalOffset = tileSize * 0.5;
                    break;

                case 'up':
                    horizontalOffset = tileSize * 0.5;
                    verticalOffset = tileSize * 0.125;
                    break;

                case 'down':
                    rotation = Math.PI;
                    horizontalOffset = tileSize * 0.5;
                    verticalOffset = tileSize * 0.875;
                    break;
            }

            var xPosition = this.object.x * tileSize + horizontalOffset - viewportRect.x;
            var yPosition = this.object.y * tileSize + verticalOffset - viewportRect.y;

            context.save();

            context.translate(xPosition, yPosition);
            context.rotate(rotation);

            var size = Math.floor(tileSize * 0.5);
            var offset = -size / 2;
            context.drawImage(this.image.data, offset, offset, size, size);

            context.restore();
        }
    };

    return RenderableLadder;
});
