define(['renderer/src/renderer', './scheduler'],
    function (Renderer, Scheduler)
    {
        'use strict';

        function UnitActions(unitLogic, map)
        {
            this.unitLogic = unitLogic;
            this.map = map;
        }

        UnitActions.prototype.move = function (unit, pathNodes, onMoveComplete)
        {
            unit.setState('run');
            Renderer.camera.trackUnit(unit);

            if (unit.statusPanel)
                unit.statusPanel.apBar.disableTransitions();

            var endTileNode = pathNodes[pathNodes.length - 1];
            var cost = this.unitLogic.beginMoveUnit(this.map, unit, endTileNode);

            var startAp = unit.ap;
            var endAp = unit.ap - cost;

            var path = pathNodes.slice();
            path.unshift(
            {
                x: unit.tileX,
                y: unit.tileY
            });

            var progressTime = 0;
            var progressPercentage = 0;
            var totalTime = endTileNode.distance / 3.5;

            for (var i = 1; i < path.length; i++)
            {
                var node = path[i];
                node.startPercentage = progressPercentage;
                node.endPercentage = node.distance / endTileNode.distance;
                node.percentageShare = node.endPercentage - node.startPercentage;
                progressPercentage = node.endPercentage;
            }

            var currentNode = path.shift();
            var nextNode = path.shift();

            Scheduler.schedule(
            {
                context: this,
                endTime: totalTime,
                method: function (e, deltaTime)
                {
                    progressTime += deltaTime;
                    var progressPercentage = progressTime / totalTime;
                    while (progressPercentage > nextNode.endPercentage)
                    {
                        currentNode = nextNode;
                        nextNode = path.shift();
                    }

                    var deltaX = nextNode.x - currentNode.x;
                    var deltaY = nextNode.y - currentNode.y;
                    unit.setDirection(deltaX, deltaY);

                    var nodeProgressPercentage = (progressPercentage - nextNode.startPercentage) / nextNode.percentageShare;
                    unit.tileX = currentNode.x + (deltaX * nodeProgressPercentage);
                    unit.tileY = currentNode.y + (deltaY * nodeProgressPercentage);

                    unit.ap = startAp + (endAp - startAp) * progressPercentage;
                    if (unit.statusPanel)
                    {
                        unit.statusPanel.updateValues();
                    }
                },
                completedMethod: function ()
                {
                    unit.setState('idle');
                    this.unitLogic.endMoveUnit(unit, endTileNode, cost);

                    if (unit.statusPanel)
                    {
                        unit.statusPanel.apBar.enableTransitions();
                        unit.statusPanel.updateValues();
                    }

                    Renderer.camera.trackUnit();
                    onMoveComplete();
                }.bind(this)
            });
        };

        UnitActions.prototype.attack = function (targetTile, affectedTiles, attack)
        {
            var results = this.unitLogic.performAttack(this.unit, attack, targetTile, affectedTiles);
            for (var i = 0; i < results.length; i++)
            {
                var result = results[i];
                if (!result.damage)
                {
                    result.unit.setState('evade');
                    result.unit.on('animationComplete', function onAnimationComplete()
                    {
                        this.setState('idle');
                        this.off('animationComplete', onAnimationComplete);
                    });
                }
            }

            this.unit.setState('attack');
            // TODO SoundManager.playTrack(attack.track);

            if (this.unit.statusPanel)
            {
                this.unit.statusPanel.updateValues();
            }

            this.unit.on('animationComplete', this, function onAttackFinished()
            {
                for (var i = 0; i < results.length; i++)
                {
                    var result = results[i];
                    if (result.damage && result.unit.statusPanel)
                    {
                        result.unit.statusPanel.updateValues();
                    }
                }

                this.unit.setState('idle');
                this.unit.off('animationComplete', this, onAttackFinished);
                this.onAttackComplete();
            });
        };

        return UnitActions;
    });
