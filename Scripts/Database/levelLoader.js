var SERVER_ROOT = 'D:/Game Server/';

var databaseManager = require(SERVER_ROOT + '/databaseManager');
var fileSystem = require('fs');

// Initial Config
var config = JSON.parse(fileSystem.readFileSync(SERVER_ROOT + '/config/config.json'));


function loadLevel(levelName, error, data)
{
    if (error)
    {
        console.log(error);
        return;
    }

    var jsonData = JSON.parse(data);
    databaseManager.levelsCollection.insert(jsonData, function (error)
    {
        if (error)
        {
            console.log(error);
            return;
        }

        console.log("Success for " + levelName);
    });
}

databaseManager.open(config.dbName, config.dbHost, config.dbPort, "", "", function ()
{
    // Intentionally skip first two arguments: "node", "levelLoader.js"
    for (var i = 2; i < process.argv.length; ++i)
    {
        var name = process.argv[i];

        fileSystem.readFile(SERVER_ROOT + "/levels/" + name + ".json", "", loadLevel.bind(this, name));
    }
});
