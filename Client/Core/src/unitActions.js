define(['renderer/src/renderer', './scheduler'],
    function (Renderer, Scheduler)
    {
        'use strict';

        return {
            move: function (unitLogic, map, unit, pathNodes)
            {
                unit.setState('run');
                Renderer.camera.trackUnit(unit);

                if (unit.statusPanel)
                    unit.statusPanel.apBar.disableTransitions();

                var endTileNode = pathNodes[pathNodes.length - 1];
                var cost = unitLogic.beginMoveUnit(map, unit, endTileNode);

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
                        unitLogic.endMoveUnit(unit, endTileNode, cost);

                        if (unit.statusPanel)
                        {
                            unit.statusPanel.apBar.enableTransitions();
                            unit.statusPanel.updateValues();
                        }

                        Renderer.camera.trackUnit();
                        this.onMoveComplete();
                    }
                });
            }
        };
    });
