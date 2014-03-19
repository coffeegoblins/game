define(['Core/src/imageCache', 'Core/src/spriteSheet', './effects/transitionEffect', 'text!../content/animations.json'], function (ImageCache, SpriteSheet, TransitionEffect, AnimationDefinitions)
{
    'use strict';

    var animations = JSON.parse(AnimationDefinitions);

    function RenderableSoldier(unit)
    {
        this.unit = unit;
        this.style = {opacity: 1};

        this.createSpriteSheets(this.unit.weapon.type);
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
            var spriteSheet = new SpriteSheet(type + animationName, 'Renderer/content/images/' + animationDefinition.spriteSheet + '.png', {
                tileWidth: animationDefinition.tileWidth,
                tileHeight: animationDefinition.tileHeight
            });

            for (var i = 0; i < 8; i++)
            {
                var frames;
                if (animationDefinition.frames)
                {
                    frames = {};
                    for (var frame in animationDefinition.frames)
                    {
                        var frameIndex = parseInt(frame, 10) * i;
                        frames[frameIndex] = animationDefinition.frames[frame];
                    }
                }

                spriteSheet.defineAnimation(i, {
                    start: i * animationDefinition.frameCount,
                    end: (i + 1) * animationDefinition.frameCount - 1,
                    isLooping: animationDefinition.isLooping,
                    speed: animationDefinition.speed,
                    frames: frames
                });
            }

            spriteSheet.on('animationComplete', this, this.onAnimationComplete);
            this.spriteSheets[animationName] = spriteSheet;
        }
    };

    RenderableSoldier.prototype.getSelectionColor = function ()
    {
        if (this.unit.isSelected)
        {
            if (this.unit.player.isLocal)
                return '#3ddb11';

            return '#f93b34';
        }

        if (this.unit.isTargeted)
            return '#a0a0a0';
    };

    RenderableSoldier.prototype.getTileX = function ()
    {
        return this.unit.tileX;
    };

    RenderableSoldier.prototype.getTileY = function ()
    {
        return this.unit.tileY;
    };

    RenderableSoldier.prototype.onDirectionChange = function ()
    {
        this.spriteSheets[this.unit.state].playAnimation(this.unit.direction);
    };

    RenderableSoldier.prototype.onAnimationComplete = function (animation)
    {
        this.unit.trigger('animationComplete', animation.name);
        if (animation.name === 'death')
        {
            TransitionEffect.transitionFloat({
                source: this.style,
                property: 'opacity',
                targetValue: 0.6
            });
        }
    };

    RenderableSoldier.prototype.render = function (context, deltaTime, camera)
    {
        var spriteSheet = this.spriteSheets[this.unit.state];
        if (!spriteSheet.image.isLoaded)
            return;

        var left, top, width, height;
        var position = camera.tileToScreen(this.unit.tileX, this.unit.tileY);
        var color = this.getSelectionColor();
        if (color)
        {
            width = camera.tileWidth * 2 / 3;
            height = camera.tileHeight * 2 / 3;

            left = position.x - camera.viewportRect.x + camera.halfTileWidth - width / 2;
            top = position.y - camera.viewportRect.y + camera.halfTileHeight - height / 2;

            drawEllipse(context, left, top, width, height);

            context.strokeStyle = color;
            context.fillStyle = color;

            context.globalAlpha = 0.3;
            context.fill();
            context.globalAlpha = 0.75;
            context.stroke();
        }

        spriteSheet.updateAnimation(deltaTime);
        var tileRect = spriteSheet.getCurrentTileBounds();
        if (tileRect)
        {
            width = spriteSheet.tileWidth * camera.scale;
            height = spriteSheet.tileHeight * camera.scale;

            left = position.x - camera.viewportRect.x + camera.halfTileWidth - width / 2;
            top = position.y - camera.viewportRect.y - height / 2;

            context.globalAlpha = this.style.opacity;
            context.drawImage(spriteSheet.image.data, tileRect.x, tileRect.y, tileRect.width, tileRect.height,
                left, top, width, height);
        }


        context.globalAlpha = 1;
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
