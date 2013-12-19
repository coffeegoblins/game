define(['renderer', 'Game/src/scheduler', 'Game/src/inputHandler', 'Game/src/levelLoader', 'Game/src/turnManager',
        'Renderer/src/ui/actionBarView', 'Renderer/src/ui/activeUnitView', 'Game/src/attackManager',
        'Game/src/movementManager'],
    function (Renderer, Scheduler, InputHandler, LevelLoader, TurnManager, ActionBarView, ActiveUnitView, AttackManager, MovementManager)
    {
        'use strict';

        function PlotManager() { }

        PlotManager.prototype.initialize = function ()
        {
            LevelLoader.loadLevel("level1", function (map, player)
            {
                this.currentMap = map;
                this.player = player;
                this.currentMap.on('tileClick', this, this.onTileSelected);

                this.activeUnitView = new ActiveUnitView();
                this.attackManager = new AttackManager(this.currentMap, this.activeUnitView);
                this.movementManager = new MovementManager(this.currentMap, this.activeUnitView);

                TurnManager.on('beginTurn', this.activeUnitView, this.activeUnitView.onBeginTurn);
                TurnManager.on('endTurn', this.activeUnitView, this.activeUnitView.onEndTurn);

                TurnManager.on('beginTurn', this.attackManager, this.attackManager.onBeginTurn);

                TurnManager.on('beginTurn', this, this.onBeginTurn);
                TurnManager.on('endTurn', this, this.onEndTurn);
                
                TurnManager.beginTurn();
            }.bind(this));
        };

        PlotManager.prototype.onBeginTurn = function (activeUnit)
        {
            Renderer.camera.moveToUnit(activeUnit, this, this.onCameraMoved);
        };

        PlotManager.prototype.onCameraMoved = function (activeUnit)
        {
            var attackActionName = activeUnit.type === 'archer' ? 'rangeAttack' : 'attack';
            ActionBarView.addActions([
                {id: 'move', method: this.movementManager.onMoveAction, context: this.movementManager},
                {id: attackActionName, method: this.attackManager.onAttackAction, context: this.attackManager},
                {id: 'endTurn', method: this.onEndTurnAction, context: this}
            ]);

            ActionBarView.showActions();

            if (activeUnit.player.name === this.player.name)
            {
                InputHandler.enableInput();
            }
        };

        PlotManager.prototype.onEndTurn = function (activeUnit)
        {
            InputHandler.disableInput();
            ActionBarView.hideActions();
            Renderer.clearRenderablePaths();
            TurnManager.beginTurn();
        };

        PlotManager.prototype.onTileSelected = function (selectedTile, tileX, tileY)
        {
            this.selectedTile = selectedTile;
            this.activeUnitView.previewAP(0);
            Renderer.clearRenderablePathById('selectedPath');

            if (selectedTile.content)
            {
                if (!selectedTile.content.isClimbable || !TurnManager.activeUnit.canClimbObjects)
                {
                    // TODO Content logic, Show action
                }
            }
        };

        PlotManager.prototype.onEndTurnAction = function ()
        {
            TurnManager.endTurn();
        };

        return new PlotManager();
    });