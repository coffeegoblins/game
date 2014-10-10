define(['core/src/imageCache', 'core/src/spriteSheet', 'text!../content/animations.json'], function (ImageCache, SpriteSheet, AnimationDefinitions)
{
    'use strict';

    var animations = JSON.parse(AnimationDefinitions);

    var directions = [
        [6, 7, 0],
        [5, 0, 1],
        [4, 3, 2]
    ];

    function RenderableSoldier(unit, localUsername)
    {
        this.unit = unit;
        this.previousDirection = directions[this.unit.direction.y + 1][this.unit.direction.x + 1];
        this.localUsername = localUsername;
        this.style = {
            opacity: 1
        };

        this.createSpriteSheets(this.unit.type);
        this.unit.on('directionChange', this.onDirectionChange.bind(this));
        this.unit.on('stateChange', this.onDirectionChange.bind(this));
        this.onDirectionChange();
    }

    RenderableSoldier.prototype.createSpriteSheets = function (type)
    {
        this.spriteSheets = {};
        var animationDefinitions = animations[type];
        for (var animationName in animationDefinitions)
        {
            var animationDefinition = animationDefinitions[animationName];
            var spriteSheet = new SpriteSheet(type + animationName, 'renderer/content/images/' + animationDefinition.spriteSheet + '.png',
            {
                tileWidth: animationDefinition.tileWidth,
                tileHeight: animationDefinition.tileHeight
            });

            for (var i = 0; i < 8; i++)
            {
                var frames = null;
                if (animationDefinition.frames)
                {
                    frames = {};
                    for (var frame in animationDefinition.frames)
                    {
                        var frameIndex = parseInt(frame, 10) + i * animationDefinition.frameCount;
                        frames[frameIndex] = animationDefinition.frames[frame];
                    }
                }

                spriteSheet.defineAnimation(i,
                {
                    id: animationName,
                    start: i * animationDefinition.frameCount,
                    end: (i + 1) * animationDefinition.frameCount - 1,
                    isLooping: animationDefinition.isLooping,
                    reverseOnComplete: animationDefinition.reverseOnComplete,
                    speed: animationDefinition.speed,
                    frames: frames
                });
            }

            spriteSheet.on('animationComplete', this, this.onAnimationComplete);
            this.spriteSheets[animationName] = spriteSheet;
        }
    };

    RenderableSoldier.prototype.getImageIndex = function ()
    {
        return this.spriteSheets[this.unit.state].image.globalIndex;
    };

    RenderableSoldier.prototype.getTileRight = function ()
    {
        return this.unit.x + 1;
    };

    RenderableSoldier.prototype.getTileBottom = function ()
    {
        return this.unit.y + 1;
    };

    RenderableSoldier.prototype.isPointInside = function (camera, x, y)
    {
        var position = camera.tileToScreen(this.unit.x, this.unit.y);

        var width = 40 * camera.scale;
        var height = 64 * camera.scale;
        var left = position.x - camera.viewportRect.x + camera.halfTileWidth - width / 2;
        var top = position.y - camera.viewportRect.y - height / 2;

        return x >= left && x <= left + width && y >= top && y <= top + height;
    };

    RenderableSoldier.prototype.onDirectionChange = function ()
    {
        var directionAnimation = directions[this.unit.direction.y + 1][this.unit.direction.x + 1];
        this.spriteSheets[this.unit.state].playAnimation(directionAnimation);
    };

    RenderableSoldier.prototype.onAnimationComplete = function (animation)
    {
        this.unit.trigger('animationComplete', animation.name);
        if (animation.id === 'death')
            this.isDead = true;
    };

    RenderableSoldier.prototype.render = function (context, deltaTime, camera)
    {
        var spriteSheet = this.spriteSheets[this.unit.state];
        if (!spriteSheet.isLoaded())
            return;

        var currentDirection = directions[this.unit.direction.y + 1][this.unit.direction.x + 1];
        if (this.previousDirection !== currentDirection)
        {
            this.previousDirection = currentDirection;
            this.spriteSheets[this.unit.state].playAnimation(currentDirection);
        }

        var position = camera.tileToScreen(this.unit.x, this.unit.y);
        position.x -= camera.viewportRect.x - camera.halfTileWidth;
        position.y -= camera.viewportRect.y;

        var width = spriteSheet.tileWidth * camera.scale;
        var height = spriteSheet.tileHeight * camera.scale;
        var left = Math.floor(position.x - width / 2);
        var top = Math.floor(position.y - height * 0.4);

        if (!camera.isInView(left, top, width, height))
            return;

        if (this.unit.isSelected || this.unit.isTargeted)
            this.renderSelection(context, camera, position);

        spriteSheet.updateAnimation(deltaTime);
        var tileRect = spriteSheet.getCurrentTileBounds();
        if (tileRect)
        {
            context.drawImage(spriteSheet.image.data, tileRect.x, tileRect.y, tileRect.width, tileRect.height,
                left, top, width, height);
        }
    };

    RenderableSoldier.prototype.renderSelection = function (context, camera, position)
    {
        var tileWidth = camera.tileWidth * 2 / 3;
        var tileHeight = camera.tileHeight * 2 / 3;

        var tileLeft = position.x - tileWidth / 2;
        var tileTop = position.y + camera.halfTileHeight - tileHeight / 2;

        drawEllipse(context, tileLeft, tileTop, tileWidth, tileHeight);

        context.lineWidth = 1;
        if (this.unit.username === this.localUsername)
        {
            context.fillStyle = 'rgba(0, 219, 48, 0.3)';
            context.strokeStyle = 'rgba(28, 105, 0, 0.5)';
        }
        else
        {
            context.fillStyle = 'rgba(255, 31, 0, 0.3)';
            context.strokeStyle = 'rgba(105, 18, 0, 0.5)';
        }

        context.fill();
        context.stroke();
    };

    function drawEllipse(context, left, top, width, height)
    {
        var horizontalOffset = (width / 2) * 0.5522848;
        var verticalOffset = (height / 2) * 0.5522848;
        var right = left + width;
        var bottom = top + height;
        var xCenter = left + width / 2;
        var yCenter = top + height / 2;

        context.beginPath();
        context.moveTo(left, yCenter);
        context.bezierCurveTo(left, yCenter - verticalOffset, xCenter - horizontalOffset, top, xCenter, top);
        context.bezierCurveTo(xCenter + horizontalOffset, top, right, yCenter - verticalOffset, right, yCenter);
        context.bezierCurveTo(right, yCenter + verticalOffset, xCenter + horizontalOffset, bottom, xCenter, bottom);
        context.bezierCurveTo(xCenter - horizontalOffset, bottom, left, yCenter + verticalOffset, left, yCenter);
        context.closePath();
    }

    return RenderableSoldier;
});
