define(['../../menu/notificationsMenu', '../../menu/activeGamesMenu', './plotManager'],
    function (NotificationMenu, ActiveGamesMenu, PlotManager)
    {
        return {
            listen: function (socket, listeners)
            {
                socket.on(listeners.notifications, NotificationMenu.onNotificationsReceived.bind(NotificationMenu));
                socket.on(listeners.gameCreations, ActiveGamesMenu.onGamesCreated.bind(ActiveGamesMenu));
                socket.on(listeners.gameUpdates, ActiveGamesMenu.onGamesUpdated.bind(ActiveGamesMenu));
                socket.on(listeners.gameUpdates, PlotManager.onGameStateUpdateReceived.bind(PlotManager));
            }
        };
    });
