#!/bin/env node
 //  OpenShift sample Node application
var express = require('express');
var fs = require('fs');
var _ = require('underscore');
var request = require('request');
var util = require('./weather_utility');
var hour_in_milliseconds = 3600000;
var ten_minutes = 600000;
var time_of_last_request = null;
var cached_weather_data = null;
/**
 *  Define the sample application.
 */
var SampleApp = function() {

    //  Scope.
    var self = this;


    /*  ================================================================  */
    /*  Helper functions.                                                 */
    /*  ================================================================  */

    /**
     *  Set up server IP address and port # using env variables/defaults.
     */
    self.setupVariables = function() {
        //  Set the environment variables we need.
        self.ipaddress = process.env.OPENSHIFT_NODEJS_IP;
        self.port = process.env.OPENSHIFT_NODEJS_PORT || 8080;

        if (typeof self.ipaddress === "undefined") {
            //  Log errors on OpenShift but continue w/ 127.0.0.1 - this
            //  allows us to run/test the app locally.
            console.warn('No OPENSHIFT_NODEJS_IP var, using 127.0.0.1');
            self.ipaddress = "127.0.0.1";
        };
    };


    /**
     *  Populate the cache.
     */
    self.populateCache = function() {
        if (typeof self.zcache === "undefined") {
            self.zcache = {
                'index.html': ''
            };
        }

        //  Local cache for static content.
        self.zcache['index.html'] = fs.readFileSync('./index.html');
    };


    /**
     *  Retrieve entry (content) from cache.
     *  @param {string} key  Key identifying content to retrieve from cache.
     */
    self.cache_get = function(key) {
        return self.zcache[key];
    };


    /**
     *  terminator === the termination handler
     *  Terminate server on receipt of the specified signal.
     *  @param {string} sig  Signal to terminate on.
     */
    self.terminator = function(sig) {
        if (typeof sig === "string") {
            console.log('%s: Received %s - terminating sample app ...',
                Date(Date.now()), sig);
            process.exit(1);
        }
        console.log('%s: Node server stopped.', Date(Date.now()));
    };


    /**
     *  Setup termination handlers (for exit and a list of signals).
     */
    self.setupTerminationHandlers = function() {
        //  Process on exit and signals.
        process.on('exit', function() {
            self.terminator();
        });

        // Removed 'SIGPIPE' from the list - bugz 852598.
        ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
            'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
        ].forEach(function(element, index, array) {
            process.on(element, function() {
                self.terminator(element);
            });
        });
    };


    /*  ================================================================  */
    /*  App server functions (main app logic here).                       */
    /*  ================================================================  */

    /**
     *  Create the routing table entries + handlers for the application.
     */
    self.createRoutes = function() {
        self.routes = {};

        self.routes['/asciimo'] = function(req, res) {
            var link = "http://i.imgur.com/kmbjB.png";
            res.send("<html><body><img src='" + link + "'></body></html>");
        };

        self.routes['/'] = function(req, res) {
            res.setHeader('Content-Type', 'text/html');
            res.send(self.cache_get('index.html'));
        };
    };


    /**
     *  Initialize the server (express) and create the routes and register
     *  the handlers.
     */
    self.initializeServer = function() {
        self.createRoutes();
        self.app = express.createServer();
        // serve static assets
        self.app.use(express.static(__dirname));

        self.app.post('/hello', function(req, res) {
            res.send(self.cache_get('index.html'));
        });

        self.app.get('/gettodaysweather', function(req, res) {
            request(
                'http://api.openweathermap.org/data/2.5/weather?id=7778677&appid=c935392369657c06e7b3d11321780514',
                function(error, response, body) {
                    if (!error && response.statusCode == 200) {
                        var weather_data = JSON.parse(body)
                        var todaysweather = {};
                        if(weather_data.wind.deg < 220 && weather_data.wind.deg > 40){
                            if(weather_data.wind.speed < 20.5 && weather_data.wind.speed > 6.1){
                                todaysweather.wind = weather_data.wind;
                                todaysweather.dt = weather_data.dt;
                            }
                        };
                    res.send(todaysweather);
                    }
                });
        });

        var get_16_day_forecast = function(res){
            request(
                'http://api.openweathermap.org/data/2.5/forecast/daily?id=7778677&mode=json&units=metric&cnt=16&appid=c935392369657c06e7b3d11321780514',
                function(error, response, body) {
                    if (!error && response.statusCode == 200) {
                        var weather_data = JSON.parse(body)
                        var wind = _.map(weather_data.list, function(weather){ return _.pick(weather, 'dt', 'deg', 'speed') })
                        var days_with_onshore_wind = _.filter(wind, function(todays_wind){ return todays_wind.deg < 220 && todays_wind.deg > 40; })
                        var days_with_good_wind_speed = _.filter(days_with_onshore_wind, function(todays_wind){ return todays_wind.speed < 20.5 && todays_wind.speed > 6.1; });
                        cached_weather_data = days_with_good_wind_speed;                        
                        res.send(days_with_good_wind_speed);
                    }
                });
        }

        self.app.get('/getweatherdata', function(req, res) {
            if(time_of_last_request == null){
                time_of_last_request = Date.now();
                get_16_day_forecast(res);
                console.log('first request ', new Date(time_of_last_request));
            }else {
                var time_difference = Date.now() - time_of_last_request;
                console.log('time difference = ' + time_difference);
                if(time_difference < ten_minutes ){
                    console.log('send cached data ');
                    console.log('last request ', new Date(time_of_last_request));
                    console.log('this request ', new Date(Date.now()));

                    res.send(cached_weather_data);
                }else{
                    console.log('send new data ');
                    console.log('last request ', new Date(time_of_last_request));
                    console.log('this request ', new Date(Date.now()));
                    time_of_last_request = Date.now();
                    get_16_day_forecast(res);
                }
            }
        });

        var get_good_conditions = function(weather_data){
            var wind = _.map(weather_data.list, function(weather){ return _.pick(weather, 'dt_txt', 'wind') })
            var days_with_onshore_wind = _.filter(wind, function(todays_wind){ return todays_wind.wind.deg < 220 && todays_wind.wind.deg > 40; })
            var days_with_good_wind_speed = _.filter(days_with_onshore_wind, function(todays_wind){ return todays_wind.wind.speed < 20.5 && todays_wind.wind.speed > 6.1; });
            //console.log(days_with_good_wind_speed)
            var dates = _.map(days_with_good_wind_speed, function(todays_wind){ return todays_wind.dt_txt.slice(0, 10); });
            dates = _.uniq(dates);
            var perfect_conditions = [];
            _.each(dates, function(date){
                var todays_wind = {};

                var wind_for_this_date = _.filter(days_with_good_wind_speed, function(todays_wind){ 
                    var current_date = todays_wind.dt_txt.slice(0, 10);
                    return current_date == date;
                });

                todays_wind.date = date;
                todays_wind.wind = wind_for_this_date;
                perfect_conditions.push(todays_wind);
            });
            return perfect_conditions;
        }

        var get_five_day_forecast = function(res){
            request(
                'http://api.openweathermap.org/data/2.5/forecast?id=7778677us&mode=json&appid=c935392369657c06e7b3d11321780514',
                function(error, response, body) {
                    if (!error && response.statusCode == 200) {
                        var weather_data = JSON.parse(body);
                        cached_weather_data = weather_data;                        
                        res.send(weather_data);
                    }
                });
        }

        self.app.get('/getFiveDayForecast', function(req, res) {
            if(time_of_last_request == null){
                time_of_last_request = Date.now();
                get_five_day_forecast(res);
                console.log('first request ', new Date(time_of_last_request));
            }else {
                var time_difference = Date.now() - time_of_last_request;
                console.log('time difference = ' + time_difference);
                if(time_difference < ten_minutes ){
                    console.log('send cached data ');
                    console.log('last request ', new Date(time_of_last_request));
                    console.log('this request ', new Date(Date.now()));

                    res.send(cached_weather_data);
                }else{
                    console.log('send new data ');
                    console.log('last request ', new Date(time_of_last_request));
                    console.log('this request ', new Date(Date.now()));
                    time_of_last_request = Date.now();
                    get_five_day_forecast(res);
                }
            }
        });

        self.app.get('/dummydata', function(req, res) {
            var weather_data = JSON.parse(fs.readFileSync('./dummy_weather_data.js'));
            var wind = _.map(weather_data.list, function(weather){ return _.pick(weather, 'dt', 'deg', 'speed') })
            var days_with_onshore_wind = _.filter(wind, function(todays_wind){ return todays_wind.deg < 220 && todays_wind.deg > 40; })
            var days_with_good_wind_speed = _.filter(days_with_onshore_wind, function(todays_wind){ return todays_wind.speed < 20.5 && todays_wind.speed > 6.1; });
            res.send(days_with_good_wind_speed);
        });

        self.app.get('/gettodaydummysweather', function(req, res) {
            var weather_data = JSON.parse(fs.readFileSync('./todaysweather.js'));
            var todaysweather = {};
            if(weather_data.wind.deg < 220 && weather_data.wind.deg > 40){
                if(weather_data.wind.speed < 20.5 && weather_data.wind.speed > 6.1){
                    todaysweather.wind = weather_data.wind;
                    todaysweather.dt = weather_data.dt;
                }
            };
            res.send(todaysweather);
        });

        self.app.get('/getFiveDayDummyData', function(req, res) {
            if(time_of_last_request == null){
                time_of_last_request = Date.now();
            };
            var time_difference = Date.now() - time_of_last_request;
            console.log('time difference = ' + time_difference);
            if(time_difference < hour_in_milliseconds ){
                console.log('send cached data');
            }else{
                console.log('send new data');
            }
            console.log(time_of_last_request);
            var weather_data = JSON.parse(fs.readFileSync('./5_day_dummy_data.js'));

            var wind = _.map(weather_data.list, function(weather){ return _.pick(weather, 'dt_txt', 'wind') })
            var days_with_onshore_wind = _.filter(wind, function(todays_wind){ return todays_wind.wind.deg < 220 && todays_wind.wind.deg > 40; })
            var days_with_good_wind_speed = _.filter(days_with_onshore_wind, function(todays_wind){ return todays_wind.wind.speed < 20.5 && todays_wind.wind.speed > 6.1; });
            //console.log(days_with_good_wind_speed)
            var dates = _.map(days_with_good_wind_speed, function(todays_wind){ return todays_wind.dt_txt.slice(0, 10); });
            dates = _.uniq(dates);
            var perfect_conditions = [];
            _.each(dates, function(date){
                var todays_wind = {};

                var wind_for_this_date = _.filter(days_with_good_wind_speed, function(todays_wind){ 
                    var current_date = todays_wind.dt_txt.slice(0, 10);
                    return current_date == date;
                });

                todays_wind.date = date;
                todays_wind.wind = wind_for_this_date;
                perfect_conditions.push(todays_wind);
            });
            res.send(perfect_conditions);
        });

        //  Add handlers for the app (from the routes).
        for (var r in self.routes) {
            self.app.get(r, self.routes[r]);
        }
    };


    /**
     *  Initializes the sample application.
     */
    self.initialize = function() {
        self.setupVariables();
        self.populateCache();
        self.setupTerminationHandlers();

        // Create the express server and routes.
        self.initializeServer();
    };


    /**
     *  Start the server (starts up the sample application).
     */
    self.start = function() {
        //  Start the app on the specific interface (and port).
        self.app.listen(self.port, self.ipaddress, function() {
            console.log('%s: Node server started on %s:%d ...',
                Date(Date.now()), self.ipaddress, self.port);
        });
    };

}; /*  Sample Application.  */



/**
 *  main():  Main code.
 */
var zapp = new SampleApp();
zapp.initialize();
zapp.start();
