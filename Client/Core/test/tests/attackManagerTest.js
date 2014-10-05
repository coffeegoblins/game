define(['core/src/attackManager', 'core/src/map', 'renderer/src/ui/unitView', 'renderer/src/ui/actionBarView', 'core/src/utility'],
    function (AttackManager, Map, UnitView, ActionBarView, Utility)
    {
        'use strict';

        function AttackManagerTest()
        {
            this.name = 'Attack Manager Test';
        }

        AttackManagerTest.prototype.setup = function ()
        {
            var map = new Map(4, 4);

            var actionBarElement = document.createElement('div');
            actionBarElement.innerHTML = '<div class="action-container"></div>';

            this.attackManager = new AttackManager(map, new ActionBarView(actionBarElement), new UnitView(document.createElement('div')));
            this.attackManager.actionBarSnapshot = [
                {}
            ];
            this.attackManager.activeUnit = {x: 0, y: 0, weapon: {range: 1}};
        };

        AttackManagerTest.prototype.tearDown = function ()
        {
            this.attackManager.actionBarSnapshot = [
                {}
            ];
            this.attackManager.onAttackActionCancelled();
        };

        AttackManagerTest.prototype.testUnitTileIsSelectable = function ()
        {
            this.attackManager.onLongShotAction();

            var targetNode = this.attackManager.availableAttackTiles[0];
            targetNode.tile.unit = {x: 0, y: 0};

            this.attackManager.onTileSelected({}, targetNode.tile, 0, 0);

            assertTruthy("Tile was not selected.", this.attackManager.selectedNode);
        };

        AttackManagerTest.prototype.testNonUnitTileClearsAttackAction = function ()
        {
            this.attackManager.selectedTile = {};
            this.attackManager.actionBarView.addActions([
                {id: 'Attack', method: null, context: this}
            ]);

            var selectedTile = {unit: null};
            this.attackManager.availableAttackTiles = [
                {tile: selectedTile}
            ];

            this.attackManager.onTileSelected({}, selectedTile, 0, 0);

            assertFalsy("Action was not cleared.", Utility.getElementByProperty(this.attackManager.actionBarView.actionsList, 'id', 'Attack'));
        };

        AttackManagerTest.prototype.testCalculateCrossNodesReturnsCorrectResult = function ()
        {
            var selectedTile = {
                x: 1, y: 1
            };

            var availableNodes = [
                { tile: { unit: {} }, x: 1, y: 0 },
                { tile: { unit: {} }, x: 1, y: 2 },
                { tile: { unit: {} }, x: 0, y: 1 },
                { tile: { unit: {} }, x: 2, y: 1 },
                { tile: { unit: null }, x: 0, y: 0 },
                { tile: { unit: null }, x: 2, y: 0 },
                { tile: { unit: null }, x: 0, y: 2 },
                { tile: { unit: null }, x: 2, y: 2 }
            ];

            var result = this.attackManager.calculateCrossNodes(selectedTile, availableNodes);

            assertTruthy('No result was found.', result.length === 4);

            for (var i = 0; i < result.length; ++i)
                assertTruthy('Invalid tile was returned.', result[i].tile.unit);
        };

        AttackManagerTest.prototype.testCalculateCrossNodesExcludesActiveUnit = function ()
        {
            var activeUnit = {hp: 100};

            this.attackManager.activeUnit = activeUnit;

            var selectedTile = {
                x: 1, y: 1,
                neighbors: []
            };

            var availableNodes = [
                { tile: { unit: activeUnit }, x: 1, y: 0 },
                { tile: { unit: {} }, x: 1, y: 2 },
                { tile: { unit: {} }, x: 0, y: 1 },
                { tile: { unit: {} }, x: 2, y: 1 },
                { tile: { unit: null }, x: 0, y: 0 },
                { tile: { unit: null }, x: 2, y: 0 },
                { tile: { unit: null }, x: 0, y: 2 },
                { tile: { unit: null }, x: 2, y: 2 }
            ];

            var result = this.attackManager.calculateCrossNodes(selectedTile, availableNodes);

            assertTruthy('Incorrect result was found.', result.length === 3);

            for (var i = 0; i < result.length; ++i)
                assertTruthy('Invalid tile was returned.', result[i].tile.unit && result[i].tile.unit !== activeUnit);
        };

        AttackManagerTest.prototype.testCrossNodesNotAccessible = function ()
        {
            var selectedTile = {
                x: 1, y: 1,
                neighbors: []
            };

            var availableNodes = [
                { tile: { unit: {} }, x: 1, y: 0 },
                { tile: {unit: {} }, x: 1, y: 2 },
                { tile: {unit: {} }, x: 0, y: 1 }
            ];

            var result = this.attackManager.calculateCrossNodes(selectedTile, availableNodes);

            assertTruthy('No result was found.', result.length === 3);

            for (var i = 0; i < result.length; ++i)
                assertTruthy('Invalid tile was returned.', result[i].tile.unit);
        };

        return AttackManagerTest;
    });
