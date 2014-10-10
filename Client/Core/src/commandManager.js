define(['renderer/src/renderer', 'core/src/plotManager', 'core/src/soundManager'],
    function (Renderer, PlotManager, SoundManager)
    {
        'use strict';

        function CommandManager()
        {}

        CommandManager.endTurn = function ()
        {
            PlotManager.turnManager.endTurn();
        };

        CommandManager.moveViewport = function (x, y, milliseconds)
        {
            Renderer.camera.moveViewport(x, y, milliseconds);
        };

        CommandManager.playTrack = function (trackName)
        {
            SoundManager.playTrack(trackName);
        };

        CommandManager.stopTrack = function (trackName)
        {
            SoundManager.stopTrack(trackName);
        };

        CommandManager.setActiveUnitAP = function (ap)
        {
            PlotManager.turnManager.activeUnit.ap = ap;
        };

        CommandManager.setAnimation = function (state)
        {
            PlotManager.turnManager.activeUnit.setState(state);
        };

        CommandManager.updateGameState = function (actions)
        {
            PlotManager.onGameStateUpdateReceived(actions);
        };

        CommandManager.getUnits = function ()
        {
            console.log(PlotManager.turnManager.unitList);
        };

        //        CommandManager.addNotification = function (notification)
        //        {
        //            Notifications.addNotification(notification);
        //        };

        window.CommandManager = CommandManager;
        return CommandManager;
    });
