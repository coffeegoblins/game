define([
        'renderer/src/renderer',
        './turnManager',
        './players/automatedPlayer',
        './players/localPlayer',
        './players/remotePlayer',
        './unitActions',
        './map',
        './soldier',
        'renderer/src/ui/actionPanel',
        'renderer/src/ui/confirmationPanel',
        './utility',
        './inputHandler'
    ],
    function (Renderer, TurnManager, AutomatedPlayer, LocalPlayer, RemotePlayer, UnitActions,
        Map, Soldier, ActionPanel, ConfirmationPanel, Utility, InputHandler)
    {
        'use strict';

        return {

            loadGame: function (socket, unitLogic, game, levelData)
            {
                InputHandler.enableInput();

                this.players = [];
                this.socket = socket;
                this.unitLogic = unitLogic;
                this.currentGame = game;
                this.currentMap = levelData.map;
                this.turnManager = new TurnManager();
                this.actionList = [];
                this.actionPanel = new ActionPanel();
                this.actionPanel.on('actionSelected', this, this.onActionSelected);
                this.unitActions = new UnitActions(this.unitLogic, this.currentMap);

                this.socket.on(this.socket.events.gameStateUpdate.response.success, function ()
                {
                    this.actionList = [];
                }.bind(this));

                Renderer.addRenderableMap(this.currentMap);

                // TODO Fix
                var currentUsername = this.socket.user.username;
                var localUnits = [];
                var remoteUnits = [];
                for (var i = 0; i < game.units.length; ++i)
                {
                    var unit = new Soldier(game.units[i]);
                    unit.isLocal = game.units[i].username === currentUsername;

                    if (unit.username === this.socket.user.username)
                    {
                        localUnits.push(unit);
                    }
                    else
                    {
                        remoteUnits.push(unit);
                    }

                    //unit.on('death', this.onSoldierDeath.bind(this));
                    //this.openUnitStatusPanel(unit);
                    this.turnManager.addUnit(unit);
                    Renderer.addRenderableSoldier(unit);
                }

                for (i = 0; i < game.usernames.length; i++)
                {
                    var username = game.usernames[i];
                    if (username === currentUsername)
                    {
                        this.localPlayer = new LocalPlayer(this.socket, unitLogic, this.currentMap, localUnits);
                        this.players.push(this.localPlayer);
                    }
                    else
                    {
                        this.players.push(new RemotePlayer(this.socket, unitLogic, this.currentMap, remoteUnits));
                    }
                }

                for (i = 0; i < this.players.length; i++)
                {
                    var player = this.players[i];
                    player.on('defeat', this, this.onPlayerDefeat);
                    player.on('endTurn', this, this.endTurn);
                    player.on('attack', this, this.onLocalUnitAttack);
                    player.on('move', this, this.onLocalUnitMove);
                }

                this.beginTurn(this.onCameraMoved.bind(this));
            },

            beginTurn: function (callback)
            {
                this.turnManager.beginTurn();

                var unit = this.turnManager.activeUnit;

                Renderer.camera.moveToUnit(this.turnManager.activeUnit, callback);

                if (this.actionList.length > 0 && unit.player !== this.localPlayer)
                {
                    // The local player is out of moves
                    this.socket.emit(this.socket.events.gameStateUpdate.url,
                    {
                        gameID: this.currentGame._id,
                        actions: this.actionList
                    });
                }
            },

            onCameraMoved: function (unit)
            {
                if (!unit.isLocal)
                {
                    return;
                }

                this.actionPanel.open(unit, this.unitLogic.getAttacks(unit));
            },

            onActionSelected: function (unit, action)
            {
                Renderer.clearRenderablePaths();
                this.actionPanel.hide();

                if (action.name === 'endTurn')
                {
                    this.endTurn();
                    return;
                }

                if (action.name === 'move')
                {
                    this.availableNodes = this.unitLogic.getMoveNodes(this.currentMap, unit);
                    Renderer.addRenderablePath('moveTiles', this.availableNodes, false);
                    this.currentMap.on('tileClick', this, this.onMoveTileSelected);
                }
                else
                {
                    this.currentAttack = action;
                    this.availableNodes = this.unitLogic.getAttackNodes(this.currentMap, unit, this.currentAttack);

                    Renderer.addRenderablePath('attack', this.availableNodes, false);
                    this.currentMap.on('tileClick', this, this.onAttackTileSelected);
                }

                this.confirmationPanel = new ConfirmationPanel();
                this.confirmationPanel.on('actionSelected', this, this.onPerformActionSelected);
                this.confirmationPanel.open(unit);
            },

            onMoveTileSelected: function (tile, tileX, tileY)
            {
                Renderer.clearRenderablePathById('selectedPath');

                this.confirmationPanel.target = {
                    tileX: tileX,
                    tileY: tileY
                };

                var pathNode = tile && Utility.getElementByProperty(this.availableNodes, 'tile', tile);
                if (pathNode)
                {
                    this.selectedTiles = this.unitLogic.calculatePathFromNodes(pathNode, this.actionPanel.target.tileX, this.actionPanel.target.tileY);
                    this.selectedTile = this.selectedTiles[this.selectedTiles.length - 1];
                    this.actionPanel.target.statusPanel.previewAP(this.unitLogic.getMoveCost(this.actionPanel.target, this.selectedTile.distance));

                    this.confirmationPanel.enableConfirm();
                    Renderer.addRenderablePath('selectedPath', this.selectedTiles, true);
                }
                else
                {
                    this.actionPanel.target.statusPanel.previewAP();
                    this.confirmationPanel.disableConfirm();
                }
            },

            onPerformActionSelected: function (actionName)
            {
                if (actionName === 'confirm')
                {
                    if (this.currentAttack)
                        this.onAttackConfirmed();
                    else
                        this.onMoveConfirmed();
                }
                else
                {
                    this.resetActionState();
                    Renderer.camera.moveToUnit(this.unit);
                }
            },

            onMoveConfirmed: function ()
            {
                InputHandler.disableInput();
                Renderer.clearRenderablePaths();
                this.actionPanel.hide();
                this.actionPanel.target.statusPanel.previewAP();

                this.unitActions.move(this.actionPanel.target, this.selectedTiles, this.onMoveComplete.bind(this));

                var endTileNode = this.selectedTiles[this.selectedTiles.length - 1];
                this.onLocalUnitMove(this.currentMap, this.actionPanel.target, endTileNode.x, endTileNode.y);
            },

            onMoveComplete: function ()
            {
                this.selectedTile = null;
                this.selectedTiles = null;
                this.currentAttack = null;
                this.availableNodes = null;

                Renderer.clearRenderablePaths();
                this.actionPanel.target.statusPanel.previewAP();
                this.actionPanel.updateActions();
                this.actionPanel.show();

                this.currentMap.off('tileClick', this, this.onMoveTileSelected);
                this.currentMap.off('tileClick', this, this.onAttackTileSelected);
                InputHandler.enableInput();
            },

            endTurn: function ()
            {
                if (this.turnManager.activeUnit.username === this.socket.user.username)
                {
                    this.actionList.push(
                    {
                        type: "ENDTURN"
                    });
                }

                this.turnManager.endTurn();

                Renderer.clearRenderablePaths();
                this.beginTurn(this.onCameraMoved.bind(this));
            },

            onLocalUnitAttack: function (unit, attack, targetTile, affectedTiles)
            {
                this.actionList.push(
                {
                    type: "ATTACK",
                    unitID: unit._id,
                    attack: attack,
                    targetTile: targetTile,
                    affectedTiles: affectedTiles
                });
            },

            onLocalUnitMove: function (map, unit, x, y)
            {
                this.actionList.push(
                {
                    type: "MOVE",
                    unitID: unit._id.toString(),
                    x: x,
                    y: y
                });
            },

            onPlayerDefeat: function (player)
            {
                console.log('player ' + player.name + ' defeated');
            },

            onGameStateUpdateReceived: function (actions)
            {
                this.performActions(actions);
            },

            performActions: function (actions)
            {
                var action = actions.shift();
                switch (action.type)
                {

                case "MOVE":
                    {
                        var unit = this.turnManager.activeUnit;
                        this.availableNodes = this.unitLogic.getMoveNodes(this.currentMap, unit);

                        for (var i = 0; i < this.availableNodes.length; ++i)
                        {
                            var node = this.availableNodes[i];
                            if (node.x === action.x && node.y === action.y)
                            {
                                this.selectedTiles = this.unitLogic.calculatePathFromNodes(node, unit.tileX, unit.tileY);
                                this.unitActions.move(this.turnManager.activeUnit, this.selectedTiles, this.performActions.bind(this, actions));
                            }
                        }

                        break;
                    }

                case "ATTACK":
                    {
                        // TODO
                        break;
                    }

                case "ENDTURN":
                    {
                        // Nothing to validate
                        this.endTurn();

                        if (actions.length === 0)
                        {
                            this.beginTurn(this.onCameraMoved.bind(this));
                            return;
                        }
                        this.beginTurn(this.performActions.bind(this, actions));

                        break;
                    }

                default:
                    // TODO Handle out of date error
                    return;

                }
            }
        };
    });
