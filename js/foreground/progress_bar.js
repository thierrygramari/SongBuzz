﻿//A progress bar which shows the elapsed time as compared to the total time of the current song.
//Changes colors based on player state -- yellow when paused, green when playing.
define(['player', '../third_party/jquery.mousewheel'], function(player){
    'use strict';
    var selector = $('#SongTimeProgressBar');
    var mousewheelTimeout = null;
    var mousewheelValue = -1;

    selector.mousewheel(function(event, delta){
        clearTimeout(mousewheelTimeout);
        player.seekStart();

        if(mousewheelValue === -1){
            mousewheelValue = parseInt(selector.val(), 10);
        }

        mousewheelValue += delta;
        setElapsedTime(mousewheelValue);

        mousewheelTimeout = setTimeout(function(){
            player.seekTo(mousewheelValue);
            mousewheelValue = -1;
        }, 250);

        $(this).trigger('manualTimeChange', mousewheelValue);
    });

    selector.mousedown(function(){
        player.seekStart();
    });

    //Bind to selector mouse-up to support dragging as well as clicking.
    //I don't want to send a message until drag ends, so mouseup works nicely.
    selector.mouseup(function(){
        player.seekTo(selector.val());
    });

    selector.change(function(){
        repaint();
    });

    //If a song is currently playing when the GUI opens then initialize with those values.
    if(player.currentTime && player.totalTime){
        selector.prop('max', player.totalTime);
        selector.val(player.currentTime);
        repaint();
    }

    //Repaints the progress bar's filled-in amount based on the % of time elapsed for current song.
    var repaint = function(){
        var elapsedTime = selector.val();
        var totalTime = selector.prop('max');

        //Don't divide by 0.
        var fill = totalTime !== '0' ? elapsedTime / totalTime : 0;
        var backgroundImage = '-webkit-gradient(linear,left top, right top, from(#ccc), color-stop('+ fill +',#ccc), color-stop('+ fill+',rgba(0,0,0,0)), to(rgba(0,0,0,0)))';
        selector.css('background-image', backgroundImage);
    };

    var setElapsedTime = function(value){
        selector.val(value);
        repaint();
    };

    var setTotalTime = function(maxValue){
        selector.prop('max', maxValue);
        repaint();
    };

    //A nieve way of keeping the progress bar up to date. 
    setInterval(function () {
        return update(); 
    }, 500);

    //Pause the GUI's refreshes for updating the timers while the user is dragging the song time slider around.
    var update = function(){
        if(!player.isSeeking) {
            setElapsedTime(player.currentTime);
            setTotalTime(player.totalTime);
        }
    };

    return {
        id: selector.prop('id'),
        selector: selector,
        get value(){
            return selector.val();
        }
    };
});