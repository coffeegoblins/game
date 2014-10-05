define(['core/src/pathManager', 'core/src/map', 'core/src/utility'], function (PathManager, Map, Utility)
{
    'use strict';

    function PathManagerTest()
    {
        this.name = 'Path Manager Test';
    }

    function getCompletedNodeAt(completedNodes, x, y)
    {
        for (var i = 0; i < completedNodes.length; ++i)
        {
            var node = completedNodes[i];
            if (node.x === x && node.y === y)
                return node;
        }
    }

    PathManagerTest.prototype.setup = function ()
    {
        this.map = new Map(4, 4);
    };

    PathManagerTest.prototype.testMaxDistanceGreaterThanMapBoundary = function ()
    {
        var completedNodes = PathManager.calculateAvailableTiles(this.map, {
            x: 0,
            y: 0,
            maxDistance: Infinity,
            maxClimbableHeight: 0,
            ignoreUnits: true
        });

        assertEquals('Invalid number of tiles calculated', this.map.tiles.length - 1, completedNodes.length);
    };

    PathManagerTest.prototype.testHeightIsUsed = function ()
    {
        var topNodeHeight = 1;
        var expectedCost = PathManager.defaultMoveCost + topNodeHeight;

        this.map.getTile(0, 0).height = 1;
        this.map.getTile(0, 2).height = 2;

        var pathNodes = PathManager.calculateAvailableTiles(this.map, {
            x: 0,
            y: 1,
            maxDistance: expectedCost,
            maxClimbableHeight: topNodeHeight,
            ignoreUnits: true
        });

        var topNode = getCompletedNodeAt(pathNodes, 0, 0);
        var bottomNode = getCompletedNodeAt(pathNodes, 0, 2);

        assertTruthy('Right node is null', topNode);
        assertFalsy('Bottom node is not null', bottomNode);

        assertEquals('Height did not contribute to the move factor', expectedCost, topNode.distance);
    };

    PathManagerTest.prototype.testGetClosestTile = function ()
    {
        var nodes = [
            {distance: 10},
            {distance: Infinity},
            {distance: 5},
            {distance: 4}
        ];

        var returnedNode = PathManager.getClosestTile(nodes);

        assertEquals('Incorrect node was returned.', 4, returnedNode.distance);
    };

    PathManagerTest.prototype.testUnitBlocksTile = function ()
    {
        this.map.getTile(1, 1).unit = {x: 1, y: 1};

        var pathNodes = PathManager.calculateAvailableTiles(this.map, {
            x: 0,
            y: 0,
            maxDistance: 20,
            maxClimbableHeight: 0
        });

        var targetNode = getCompletedNodeAt(pathNodes, 1, 1);

        assertFalsy('Tile was not blocked by unit', targetNode);
    };

    PathManagerTest.prototype.testWorldObjectBlocksTile = function ()
    {
        this.map.addObject({sizeX: 1, sizeY: 1}, 1, 1);

        var pathNodes = PathManager.calculateAvailableTiles(this.map, {
            x: 0,
            y: 0,
            maxDistance: 20,
            maxClimbableHeight: 0
        });

        var targetNode = getCompletedNodeAt(pathNodes, 1, 1);

        assertFalsy('Tile was not blocked by world object', targetNode);
    };

    PathManagerTest.prototype.testDiagonalMovementNearWorldObjects = function ()
    {
        this.map.addObject({sizeX: 1, sizeY: 1}, 1, 1);

        var nodes = PathManager.calculateAvailableTiles(this.map, {
            x: 1,
            y: 0,
            maxDistance: 20,
            maxClimbableHeight: 10,
            ignoreUnits: true
        });

        var currentNode = Utility.getElementByProperties(nodes, {x: 2, y: 1});
        var pathNodes = PathManager.calculatePathFromNodes(currentNode, 1, 0);

        assertEquals('Path was not the correct length', 2, pathNodes.length);
        assertTruthy('First path node was incorrect', pathNodes[0].x === 2 && pathNodes[0].y === 0);
        assertTruthy('Second path node was incorrect', pathNodes[1].x === 2 && pathNodes[1].y === 1);
    };

    PathManagerTest.prototype.testProhibitiveTileHeightDifferences = function ()
    {
        this.map.getTile(1, 1).height = 3;

        var pathNodes = PathManager.calculateAvailableTiles(this.map, {
            x: 0,
            y: 0,
            maxDistance: 20,
            maxClimbableHeight: 2
        });

        var targetNode = getCompletedNodeAt(pathNodes, 1, 1);

        assertFalsy('Tile was not blocked by prohibitive height difference', targetNode);
    };

    PathManagerTest.prototype.testClimbableWorldObjects = function ()
    {
        this.map.addObject({isClimbable: true, sizeX: 1, sizeY: 1}, 1, 1);

        this.map.getTile(1, 1).height = 10;
        this.map.getTile(1, 2).height = 10;

        var pathNodes = PathManager.calculateAvailableTiles(this.map, {
            x: 1,
            y: 0,
            maxDistance: 20,
            maxClimbableHeight: 2,
            ignoreUnits: true,
            canClimbObjects: true
        });

        var targetNode = getCompletedNodeAt(pathNodes, 1, 1);
        assertTruthy('Climbable object could not be accessed', targetNode);
    };

    PathManagerTest.prototype.testDiagonalMovementNearClimbableWorldObjects = function ()
    {
        this.map.addObject({isClimbable: true, sizeX: 1, sizeY: 1}, 1, 1);

        var pathNodes = PathManager.calculateAvailableTiles(this.map, {
            x: 1,
            y: 0,
            maxDistance: 20,
            maxClimbableHeight: 0,
            ignoreUnits: true,
            canClimbObjects: true
        });

        var currentNode = Utility.getElementByProperties(pathNodes, {x: 2, y: 1});
        var targetPath = PathManager.calculatePathFromNodes(currentNode, 1, 0);

        assertEquals('Path was not the correct length', 1, targetPath.length);
        assertTruthy('Path node was incorrect', targetPath[0].x === 2 && targetPath[0].y === 1);
    };

    return PathManagerTest;
});
