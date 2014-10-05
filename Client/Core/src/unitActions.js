define(['renderer/src/renderer', './scheduler'],
    function (Renderer, Scheduler)
    {
        'use strict';

        function UnitActions(gameLogic, map)
        {
            this.gameLogic = gameLogic;
            this.map = map;
        }

        UnitActions.prototype.move = function (unit, pathNodes, onMoveComplete)
        {
            unit.setState('run');
            Renderer.camera.trackUnit(unit);

            if (unit.statusPanel)
            {
                unit.statusPanel.apBar.disableTransitions();
            }

            var endTileNode = pathNodes[pathNodes.length - 1];
            var cost = this.gameLogic.beginMoveUnit(this.map, unit, endTileNode);

            var startAp = unit.ap;
            var endAp = unit.ap - cost;

            var path = pathNodes.slice();
            path.unshift(
            {
                x: unit.x,
                y: unit.y
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
                    unit.x = currentNode.x + (deltaX * nodeProgressPercentage);
                    unit.y = currentNode.y + (deltaY * nodeProgressPercentage);

                    unit.ap = startAp + (endAp - startAp) * progressPercentage;
                    if (unit.statusPanel)
                    {
                        unit.statusPanel.updateValues();
                    }
                },
                completedMethod: function ()
                {
                    unit.setState('idle');
                    this.gameLogic.endMoveUnit(unit, endTileNode, cost);

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

        UnitActions.prototype.attack = function (unit, targetNode, attack, onAttackComplete)
        {
            var results = this.gameLogic.attacks[attack.name].performAttack(unit, targetNode);

            unit.setState('attack');
            // TODO SoundManager.playTrack(attack.track);

            if (unit.statusPanel)
            {
                unit.statusPanel.updateValues();
            }

            unit.on('animationComplete', this, function onAttackFinished()
            {
                for (var i = 0; i < results.length; i++)
                {
                    var result = results[i];
                    if (!result)
                    {
                        result.unit.setState('evade');
                        result.unit.on('animationComplete', this.onAnimationComplete);
                        continue;
                    }

                    if (result.damage && result.unit.statusPanel)
                    {
                        result.unit.statusPanel.updateValues();
                    }
                }

                unit.setState('idle');
                unit.off('animationComplete', this, onAttackFinished);
                onAttackComplete();
            });
        };

        UnitActions.prototype.onAnimationComplete = function ()
        {
            this.setState('idle');
            this.off('animationComplete', this.onAnimationComplete);
        };

        return UnitActions;
    });
