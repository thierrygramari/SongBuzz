﻿//A global object which abstracts more difficult implementations of retrieving data from YouTube.
YTHelper = (function(){
    "use strict";
    //Be sure to filter out videos and suggestions which are restricted by the users geographic location.
    var startIndex = 1;
    var searchUrl = "https://gdata.youtube.com/feeds/api/videos?category=Music&orderBy=relevance&start-index=" + startIndex + "&time=all_time&max-results=50&format=5&v=2&alt=json&callback=?&restriction=" + geoplugin_countryCode() + "&q=";
    var suggestUrl = "https://suggestqueries.google.com/complete/search?hl=en&ds=yt&client=youtube&hjson=t&cp=1&format=5&v=2&alt=json&callback=?&restriction=" + geoplugin_countryCode() + "&q=";
        
    //This is necessary because not all songs will play embedded, but YouTube does not expose all the criterion for a song not playing.
    //http://apiblog.youtube.com/2011/12/understanding-playback-restrictions.html
    var blacklist = ['7AW9C3-qWug'];

    //Convert JSON response into object.
    var buildYouTubeVideo = function(entry){
        var youtubeVideo = {
            //Strip out the videoid. An example of $t's contents: tag:youtube.com,2008:video:UwHQp8WWMlg
            videoId: entry.id.$t.substring(entry.id.$t.length - 11),
            title: entry.title.$t,
            duration: entry.media$group.yt$duration.seconds,
            accessControls: entry.yt$accessControls,
            appControl: entry.app$control,
            //Returns whether the video was found to have any content restrictions which would restrict playback.
            isPlayable: function(){
                var isPlayable = $.inArray(this.videoId, blacklist) !== 0;

                //A video may have access controls which limit its playability. IE: embedding disabled, syndication disabled.
                $(this.accessControls).each(function(){
                    if (this.permission === "denied" && (this.action === "embed" || this.action === "syndicate")){
                        isPlayable = false;
                    }
                });

                //Restrictions may be implemented at a parent level, though, too.
                if(this.appControl){
                    var appControlState = this.appControl.yt$state;

                    if (appControlState.name === "restricted" && appControlState.reasonCode === "limitedSyndication"){
                        isPlayable = false;
                    }
                }

                return isPlayable;
            }
        };

        return youtubeVideo;
    };

    return {
        //Determine whether a given youtube video will play properly inside of the Google Chrome Extension.
        //http://apiblog.youtube.com/2011/12/understanding-playback-restrictions.html
        //NOTE: YouTube has explicitly stated that the only way to know 'for sure' that a video will play is to click 'Play.'
        //This statement has been proven quite true. As such, this method will only state whether a video is playable based on information exposed via the YouTube API.
        isPlayable: function (youtubeVideoId, callback) {
            this.getVideoInformation(youtubeVideoId, function(videoInformation){
                if (videoInformation != null){
                    var video = buildYouTubeVideo(videoInformation);
                    callback(video.isPlayable());   
                }
                else{
                    callback(false);
                }
            });
        },

        //Performs a search of YouTube with the provided text and returns a list of playable videos (<= max-results)
        search: function (text, callback) {
            $.getJSON(searchUrl + text, function (response) {
                var playableVideos = [];

                //TODO: Dictionary. Just lazy.
                var banLiveResults = text.toLowerCase().indexOf("live") == -1;
                var banCovers = text.toLowerCase().indexOf("cover") == -1;
                var banRemixes = text.toLowerCase().indexOf("remix") == -1;
                var banKaraoke = text.toLowerCase().indexOf("karaoke") == -1;

                //Add all playable songs to a list and return.
                $(response.feed.entry).each(function(i){
                    var video = buildYouTubeVideo(this);
                    console.log("processing", video);

                    //Filter out live results when the user hasn't specified live in search results.
                    if(banLiveResults && video.title.toLowerCase().indexOf("live") != -1)
                        return;

                    if(banCovers && video.title.toLowerCase().indexOf("cover") != -1)
                        return;

                    if(banRemixes && video.title.toLowerCase().indexOf("remix") != -1)
                        return;

                    if(banKaraoke && video.title.toLowerCase().indexOf("karaoke") != -1)
                        return;

                    if(video.isPlayable()){
                        console.log("found playable");
                        playableVideos.push(video);
                    }
                });

                callback(playableVideos);
            });
        },

        //Takes a videoId which is presumed to have content restrictions and looks through YouTube
        //for a song with a similiar name that might be the right song to play.
        findPlayableByVideoId: function(videoId, callback){
            this.getVideoInformation(videoId, function(videoInformation){
                if (videoInformation != null) {
                    var songName = videoInformation.title.$t;
                    YTHelper.search(songName, function (videos) {
                        var playableSong = null;

                        videos.sort(function(a,b){
                            //TODO: I might also want to consider the distance between users input text and a/b title
                            return levDist(a.title, songName) - levDist(b.title, songName);
                        });

                        var wait = false;
                        var processInterval = setInterval(function(){
                            if(!wait){
                                var currentVideo = videos.shift();

                                if(currentVideo){
                                    wait = true;
                                    if(currentVideo.isPlayable()){
                                        chrome.extension.getBackgroundPage().SongValidator.validateSongById(currentVideo.videoId, function(result){
                                            wait = false;
                                            if(result){
                                                clearInterval(processInterval);
                                                callback(currentVideo);
                                                return;
                                            }
                                        });
                                    }
                                    else{
                                        wait = false;
                                    }
                                }
                            }
                        }, 200)
                    });
                }
            });
        },

        //Takes a URL and returns a videoId if found inside of the URL.
        parseUrl: function(url){
            //First try the really simple match -- ?v=''
            var videoId = $.url(url).param('v');

            if (!videoId) {
                //Try more robust matching pattern. I'm using this along with the URL jQuery plug-in because I can't decipher this regex, but it matches a lot.
                var match = url.match(/^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/);
                if (match && match[7].length === 11){
                    videoId = match[7];
                }
            }

            return videoId;
        },

        // Returns NULL if the request throws a 403 error if videoId has been banned on copyright grounds.
        getVideoInformation: function(videoId, callback){
            $.jsonp({
              "url": 'https://gdata.youtube.com/feeds/api/videos/' + videoId + '?v=2&alt=json-in-script&callback=?',
              "data": {
                  "alt": "json-in-script"
              },
              "success": function(result) {
                  callback(result.entry);
              },
              "error": function(d,msg) {
                  callback(null);
              }
            });
        }
    };
})();