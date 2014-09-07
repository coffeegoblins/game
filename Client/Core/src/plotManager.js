define([
        'renderer/src/renderer',
        './turnManager',
        './players/automatedPlayer',
        './players/localPlayer',
        './players/remotePlayer'
    ],
    function (Renderer, TurnManager, AutomatedPlayer, LocalPlayer, RemotePlayer)
    {
        'use strict';

        return {
            loadLevel: function (socket, unitLogic, levelData, users)
            {
                this.players = [];
                this.socket = socket;
                this.currentMap = levelData.map;
                this.turnManager = new TurnManager();
                this.unitActions = [];

                Renderer.addRenderableMap(this.currentMap);

                for (var i = 0; i < levelData.objects.length; i++)
                {
                    var obj = levelData.objects[i];
                    levelData.map.addObject(obj, obj.x, obj.y);
                    Renderer.addRenderableObject(obj);
                }

                var currentUsername = this.socket.user.username;
                for (i = 0; i < users.length; i++)
                {
                    var user = users[i];
                    if (user.username === currentUsername)
                    {
                        this.localPlayer = new LocalPlayer(this.socket, unitLogic, this.currentMap, user.units);
                        this.players.push(this.localPlayer);
                    }
                    else
                    {
                        this.players.push(new RemotePlayer(this.socket, unitLogic, this.currentMap, user.units));
                    }
                }

                for (i = 0; i < this.players.length; i++)
                {
                    var player = this.players[i];
                    player.on('defeat', this, this.onPlayerDefeat);
                    player.on('endTurn', this, this.endTurn);
                    player.on('attack', this, this.onLocalUnitAttack);
                    player.on('move', this, this.onLocalUnitMove);

                    for (var j = 0; j < player.units.length; j++)
                    {
                        var unit = player.units[j];
                        this.turnManager.addUnit(unit);
                        Renderer.addRenderableSoldier(unit);
                        this.currentMap.addUnit(unit, unit.tileX, unit.tileY);
                    }
                }

                this.beginTurn();
            },

            beginTurn: function ()
            {
                this.turnManager.beginTurn();

                var unit = this.turnManager.activeUnit;
                unit.isSelected = true;
                Renderer.camera.moveToUnit(unit, this.onCameraMoved.bind(this));

                // Update all the turn numbers
                for (var i = 0; i < this.players.length; i++)
                {
                    var player = this.players[i];
                    for (var j = 0; j < player.units.length; j++)
                    {
                        var currentUnit = player.units[j];
                        if (currentUnit.statusPanel)
                        {
                            currentUnit.statusPanel.updateValues();
                        }
                    }
                }

                if (this.unitActions.length > 0 && unit.player !== this.localPlayer)
                {
                    // The local player is out of moves
                    this.socket.emit(this.socket.events.gameStateUpdate.url, this.unitActions);

                    // TODO Clear when successful, check for error
                    this.unitActions = [];
                }
            },

            endTurn: function ()
            {
                if (this.turnManager.activeUnit.player === this.localPlayer)
                {
                    this.unitActions.push(
                    {
                        type: "ENDTURN"
                    });
                }

                this.turnManager.activeUnit.isSelected = false;
                this.turnManager.endTurn();

                Renderer.clearRenderablePaths();
                this.beginTurn();
            },

            onLocalUnitAttack: function (unit, attack, targetTile, affectedTiles)
            {
                this.unitActions.push(
                {
                    type: "ATTACK",
                    unitID: unit._id,
                    attack: attack,
                    targetTile: targetTile,
                    affectedTiles: affectedTiles
                });
            },

            onLocalUnitMove: function (map, unit, endNode)
            {
                this.unitActions.push(
                {
                    type: "MOVE",
                    unitID: unit._id,
                    endNode: endNode
                });
            },

            onCameraMoved: function (unit)
            {
                unit.player.performTurn(unit);
            },

            onPlayerDefeat: function (player)
            {
                console.log('player ' + player.name + ' defeated');
            }
        };
    });
