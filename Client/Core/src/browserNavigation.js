define(['./events'], function (Events)
{
    'use strict';

    var currentStateName = 'root';
    var historyMap = {
        root: history.length
    };
    // TODO Fix
    //history.replaceState({source: currentStateName});

    function BrowserNavigation()
    {}

    window.addEventListener('beforeunload', function (e)
    {
        var eventObj = {};
        BrowserNavigation.trigger('exit', eventObj);
        if (eventObj.cancel)
        {
            e.preventDefault();
        }
    }, false);

    window.addEventListener('popstate', function ()
    {
        var newStateName = history.state ? history.state.source : 'root';
        if (newStateName === currentStateName)
            return;

        BrowserNavigation.trigger('leaving:' + currentStateName);
        BrowserNavigation.trigger(newStateName, history.state);
        currentStateName = newStateName;
    }, false);


    BrowserNavigation.addState = function (stateName, data, replaceCurrent)
    {
        BrowserNavigation.trigger('leaving:' + currentStateName);

        var newState = {
            source: stateName,
            data: data
        };
        if (replaceCurrent)
        {
            history.replaceState(newState);
            delete historyMap[currentStateName];
        }
        else
        {
            history.pushState(newState);
        }

        historyMap[stateName] = historyMap[currentStateName] + 1;
        currentStateName = stateName;
    };

    BrowserNavigation.goTo = function (stateName)
    {
        if (stateName !== currentStateName)
        {
            var historyState = historyMap[stateName];
            if (historyState != null)
                history.go(historyState - historyMap[currentStateName]);
        }
    };

    Events.register(BrowserNavigation);
    return BrowserNavigation;
});
