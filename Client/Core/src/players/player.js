define(['../events', '../options', 'renderer/src/renderer', '../scheduler', '../soldier', '../soundManager', 'renderer/src/ui/unitStatusPanel', '../utility'],
    function (Events, Options, Renderer, Scheduler, Soldier, SoundManager, UnitStatusPanel, Utility)
    {
        'use strict';

        function getOption(key, isSelection)
        {
            return Options[key] === 'always' || (isSelection && Options[key] === 'selected');
        }

        function Player(socket, unitLogic, map, units)
        {
            this.map = map;
            this.socket = socket;
            this.unitLogic = unitLogic;

            this.units = units;
            for (var i = 0; i < units.length; i++)
            {
                var unit = units[i];
                unit.player = this;
                unit.on('death', this.onSoldierDeath.bind(this));
                this.openUnitStatusPanel(unit);
            }
        }

        Player.prototype.endTurn = function ()
        {
            this.closeUnitStatusPanel(this.unit);
            this.trigger('endTurn', this);
            this.unit = null;
        };

        Player.prototype.closeUnitStatusPanel = function (unit, force)
        {
            if (unit && unit.statusPanel)
            {
                if (!force)
                {
                    var options = this.getUnitStatusPanelOptions(unit);
                    if (options)
                    {
                        unit.statusPanel.setOptions(options);
                        return;
                    }
                }

                unit.statusPanel.close();
                unit.statusPanel = null;
            }
        };

        Player.prototype.getUnitStatusPanelOptions = function (unit, isSelection)
        {
            var options = {};
            options.showTurnIndicator = getOption('showTurnIndicator', isSelection);

            if (unit.username === this.socket.user.username)
            {
                options.showHP = getOption('showTeamHP', isSelection);
                options.showAP = getOption('showTeamAP', isSelection);
            }
            else
            {
                options.showHP = getOption('showEnemyHP', isSelection);
                options.showAP = getOption('showEnemyAP', isSelection);
            }

            if (options.showHP || options.showAP || options.showTurnIndicator)
                return options;
        };

        Player.prototype.moveUnit = function (tiles)
        {
            this.unit.setState('run');
            Renderer.camera.trackUnit(this.unit);

            if (this.unit.statusPanel)
                this.unit.statusPanel.apBar.disableTransitions();

            var endTileNode = tiles[tiles.length - 1];
            var cost = this.unitLogic.beginMoveUnit(this.map, this.unit, endTileNode);

            var startAp = this.unit.ap;
            var endAp = this.unit.ap - cost;

            var path = tiles.slice();
            path.unshift({x: this.unit.tileX, y: this.unit.tileY});

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

            Scheduler.schedule({
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
                    this.unit.setDirection(deltaX, deltaY);

                    var nodeProgressPercentage = (progressPercentage - nextNode.startPercentage) / nextNode.percentageShare;
                    this.unit.tileX = currentNode.x + (deltaX * nodeProgressPercentage);
                    this.unit.tileY = currentNode.y + (deltaY * nodeProgressPercentage);

                    this.unit.ap = startAp + (endAp - startAp) * progressPercentage;
                    if (this.unit.statusPanel)
                    {
                        this.unit.statusPanel.updateValues();
                    }
                },
                completedMethod: function ()
                {
                    this.unit.setState('idle');
                    this.unitLogic.endMoveUnit(this.unit, endTileNode, cost);

                    if (this.unit.statusPanel)
                    {
                        this.unit.statusPanel.apBar.enableTransitions();
                        this.unit.statusPanel.updateValues();
                    }

                    Renderer.camera.trackUnit();
                    this.onMoveComplete();
                }
            });
        };

        Player.prototype.onSoldierDeath = function (unit)
        {
            this.unitLogic.breakCombatLock(unit);
            this.closeUnitStatusPanel(unit, true);
            Utility.removeElement(this.units, unit);

            if (!this.units.length)
                this.trigger('defeat', this);
        };

        Player.prototype.openUnitStatusPanel = function (unit, isSelection)
        {
            var options = this.getUnitStatusPanelOptions(unit, isSelection);
            if (!options)
                return;

            if (!unit.statusPanel)
            {
                unit.statusPanel = new UnitStatusPanel(this.socket.user.username);
                unit.statusPanel.open(unit);
            }

            unit.statusPanel.setOptions(options);
        };

        Player.prototype.performAttack = function (targetTile, affectedTiles, attack)
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
            SoundManager.playTrack(attack.track);

            if (this.unit.statusPanel)
                this.unit.statusPanel.updateValues();

            this.unit.on('animationComplete', this, function onAttackFinished()
            {
                for (var i = 0; i < results.length; i++)
                {
                    var result = results[i];
                    if (result.damage && result.unit.statusPanel)
                        result.unit.statusPanel.updateValues();
                }

                this.unit.setState('idle');
                this.unit.off('animationComplete', this, onAttackFinished);
                this.onAttackComplete();
            });
        };

        Player.prototype.performTurn = function (unit)
        {
            this.unit = unit;
            this.openUnitStatusPanel(unit, true);
        };

        Events.register(Player.prototype);
        return Player;
    });
