var perfect_conditions;
var wind;
var days_of_week = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/*
*
* Get weather data from server.
* Create array of only the good wind conditins.
* Add event handlers.
* Hide elements as necessary.
*
*/
$.get("/getFiveDayForecast", function(forecast) {
    perfect_conditions = get_good_conditions(forecast);
    render_forecast_data(perfect_conditions);
    add_click_handlers();
    hide_elements_for_first_load();
});

/*
*
* Add on click handlers.
*
*/

var add_click_handlers = function(){
    add_more_info_handler();
    add_less_info_handler();
}

/*
*
* Hide required elements for first load.
*
*/
var hide_elements_for_first_load = function(){
    $('.forecast_by_hour').hide();
    $('.less_info').hide();
}

/*
*
* More info click functionality.
*
*/
var more_info_click_functionality = function(context){
    var forecast_by_hour = $(context).parent().parent().children().first().children()[1];
    $(forecast_by_hour).show();
    var avg = $(context).parent().parent().children().first().children()[0];
    var less_info = $(context).parent().children()[1];
    $(less_info).show();
    $(avg).hide();
    $(context).hide();
}

/*
*
* Less info click functionality.
*
*/
var less_info_click_functionality = function(context){
    var forecast_avg = $(context).parent().parent().children().first().children()[0];
    $(forecast_avg).show();
    var forecast_hourly = $(context).parent().parent().children().first().children()[1];
    var more_info = $(context).parent().children()[0];
    $(more_info).show();
    $(forecast_hourly).hide();
    $(context).hide();
}

/*
*
* Add more info click handler.
*
*/
var add_more_info_handler = function() {
    $(".more_info").click(function() {
    	more_info_click_functionality(this);
    });
}

/*
*
* Add less info click handler.
*
*/
var add_less_info_handler = function() {
    $(".less_info").click(function() {
    	less_info_click_functionality(this);
    });
}

/*
*
* Convert date to day/month/date/year.
*
*/
var convert_date_five_day_forecast = function(date) {
    var date = new Date(date);
    var day = date.getDate();
    var day_of_week = days_of_week[date.getDay()];
    var month = months[date.getMonth()];
    var year = date.getFullYear();
    return day_of_week + ' ' + month + ' ' + day + ' ' + year;
}

/*
*
* Convert utc to readable date.
*
*/
function convertDateTime(utc) {
    var date_time = new Date(utc.dt * 1000);
    var day = days_of_week[date_time.getDay()];
    var date = date_time.getDate();
    var month = months[date_time.getMonth()];
    var year = date_time.getFullYear();
    var date_time_formatted = day + ' ' + month + ' ' + date + ' ' + year;
    return date_time_formatted;
}

/*
*
* convert degrees to on/cross shore.
*
*/
function convertDegreesToDirection(degrees) {
    var direction;
    if (40 < degrees && degrees < 60) {
        direction = 'cross shore';
    } else if (200 < degrees && degrees < 220) {
        direction = 'cross shore';
    } else if (60 < degrees && degrees < 90) {
        direction = 'cross/on shore';
    } else if (180 < degrees && degrees < 200) {
        direction = 'cross/on shore';
    } else {
        direction = 'on shore';
    }
    return direction;
}


/*
 *
 * Arrange wind data by date.
 *
 * @param
 * 	wind - arry of wind data objects.
 *
 * @return
 * 	wind data arranged by date.	
 *
 */
var arrange_wind_data_by_date = function(wind, dates) {
    var perfect_conditions = [];
    _.each(dates, function(date) {
        var todays_wind = {};

        var wind_for_this_date = _.filter(wind, function(todays_wind) {
            var current_date = todays_wind.dt_txt.slice(0, 10);
            return current_date == date;
        });

        todays_wind.date = date;
        todays_wind.wind = wind_for_this_date;
        perfect_conditions.push(todays_wind);
    });
    return perfect_conditions;
}

/*
 *
 * Calculate daily average conditions and add to wind object.
 *
 * @param
 * 	wind - array of wind data.
 *
 * @return
 * 	perfect_conditions - array of wind data objects with avg. condt. added.
 *
 */
var add_daily_average_wind = function(wind) {
    var perfect_conditions = wind;
    _.each(perfect_conditions, function(today) {
        // get daily average
        var wind_day_1 = today;
        var wind_data_day_1 = _.pluck(wind_day_1.wind, 'wind');
        var total_speed_today = _.reduce(wind_data_day_1, function(memo, num) {
            return memo + num.speed;
        }, 0);
        var average_speed_today = total_speed_today / wind_data_day_1.length;
        average_speed_today = Math.floor(average_speed_today);
        var total_degrees_today = _.reduce(wind_data_day_1, function(memo, num) {
            return memo + num.deg;
        }, 0);
        var average_degrees_today = total_degrees_today / wind_data_day_1.length;
        average_degrees_today = Math.floor(average_degrees_today);
        var avg_conditions = {};
        avg_conditions.date = wind_day_1.date;
        avg_conditions.speed = average_speed_today;
        avg_conditions.deg = average_degrees_today;
        today.avg_condt = avg_conditions;
    })
    return perfect_conditions;
}


/*
 *
 * Get good conditions from 5 day weather data.
 *
 * @param
 * 	weather data - openweathermap api 5 day weather data as json.
 *
 * @return
 * 	array containing only good days.
 *
 */
var get_good_conditions = function(weather_data) {
    var wind = _.map(weather_data.list, function(weather) {
        return _.pick(weather, 'dt_txt', 'wind')
    })
    var days_with_onshore_wind = _.filter(wind, function(todays_wind) {
        return todays_wind.wind.deg < 220 && todays_wind.wind.deg > 40;
    })
    var days_with_good_wind_speed = _.filter(days_with_onshore_wind, function(todays_wind) {
        return todays_wind.wind.speed < 20.5 && todays_wind.wind.speed > 6.1;
    });
    var wind_filtered_by_time_6am_to_6pm = _.filter(days_with_good_wind_speed, function(today) {
        return today.dt_txt.slice(11, 19) >= '06' && today.dt_txt.slice(11, 19) <= '18';
    });
    //console.log(days_with_good_wind_speed)
    var dates = _.map(wind_filtered_by_time_6am_to_6pm, function(todays_wind) {
        return todays_wind.dt_txt.slice(0, 10);
    });
    dates = _.uniq(dates);
    var perfect_conditions = arrange_wind_data_by_date(wind_filtered_by_time_6am_to_6pm, dates);
    perfect_conditions = add_daily_average_wind(perfect_conditions);

    return perfect_conditions;
}

/*
*
* Render forecast data.
*
*/
var render_forecast_data = function(forecast) {
    var day_compiled = _.template("<span><%= day %> </span>");
    var speed_compiled = _.template("<span><%= speed %>kts <span>");
    var deg_compiled = _.template("<span><%= deg %> <span>");
    var time_compiled = _.template("<span><%= time %> <span>");

    html = '';
    _.each(forecast, function(today) {
        var date = convert_date_five_day_forecast(today.date);
        html += '<div class="panel panel-default"><div class="panel-heading"><h3 class="panel-title">';
        html += day_compiled({
            day: date
        });
        html += '</h3></div><div class="panel-body">';

        var speed_kts = Math.round(today.avg_condt.speed * 1.94384);
        var direction = convertDegreesToDirection(today.avg_condt.deg);
        html += '<div class="row"><div class="col-xs-7">';
        html += '<div class="forecast_avg">';
        html += speed_compiled({
            speed: speed_kts
        });
        html += deg_compiled({
            deg: direction
        });
        html += '</div>';
        // render full forecast
        html += '<div class="forecast_by_hour">';
        _.each(today.wind, function(wind) {
            var speed_kts = Math.round(wind.wind.speed * 1.94384);
            var direction = convertDegreesToDirection(wind.wind.deg);
            var time = wind.dt_txt.slice(10, 16);;

            html += speed_compiled({
                speed: speed_kts
            });
            html += deg_compiled({
                deg: direction
            });
            html += time_compiled({
                time: time
            });
            html += '<br>'
        });
        html += '</div>';

        html += '</div>';
        html += '<div class="col-xs-5">';
        html += '<p class="more_info text-right">more info...</p>';
      	html += '<p class="less_info text-right">less info...</p></div>';
        html += '</div>';
        html += '</div>';
        html += '</div></div>';
    })

    $("#5_day_forecast").append(html);
}
