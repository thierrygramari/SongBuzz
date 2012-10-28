//Defines the whole left side song drag-and-drop / recognition area.
define(['recognitionArea', 'audioScrobbler', 'recognitionList', 'backend', 'recognitionImageBuilder'], 
    function(recognitionArea, audioScrobbler, recognitionList, backend, recognitionImageBuilder){
    'use strict';

    //Whenever a user drops a song onto the left-hand side drop area
    //and it is a viable song to add -- add it to the recognition list
    //by getting its meta data. Show some images to the user to indicate success. 
    //[Meo] TODO: Is this a good event name?
    recognitionArea.onSongDropped(function(event, song){
        //Need a base song div element to attach any data to -- so add that to the page.
        recognitionList.addSong(song);

        //Show that progress has been made by displaying a youtube image icon.
        var youtubeMetroImage = recognitionImageBuilder.buildYoutubeMetroImage();
        recognitionList.addImageToCurrentSong(youtubeMetroImage);

        //TODO: This code needs a home. Should it be handled when creating a song object?
        //Get tag properly
        //This helps the metaData function properly find metadata by throwing out garbage.
        var termstoremove = ["HD", "official", "video", "-", "audio", "lyrics", "feat", "ft."];
        $.each(termstoremove, function(k, v) {
            var regex = new RegExp(v, "gi");
            song.title = song.title.replace(regex, "");
        });
        //Remove brackets
        // [Meo]: This removes a lot of remixes. We should try and make the logic smarter so that
        // If a remix is detected we trim out some stuff but not the remix or remix artist.
        // song.title = cropuntil(cropuntil(song.title, "("), "/");
        // song.title = cropuntil(cropuntil(song.title, "["), "/");

        searchMetaData(song);
    });

    //If its not the right type of link (doesn't match regexp) then let the user know
    recognitionArea.onLinkNotRecognized(function(){
        var unrecognizedLinkNotice = $('<p>', {
            'class': 'fadeandslide',
            //TODO: Internationalization?
            text: 'Link cannot be recognized. Try a YouTube link!'
        });

        recognitionList.addNotice(unrecognizedLinkNotice);
    });

    //Go out to audioscrobbler and ask it for metadata information
    //Metadata information includes artist/song/album/album cover art.
    function searchMetaData(song){
        //FEEDBACK HERE
        audioScrobbler.getData(song.title, function(json){
            var totalResults = parseInt(json.results["opensearch:totalResults"], 10);

            if (totalResults !== 0) {
                var track = totalResults === 1 ? json.results.trackmatches.track : json.results.trackmatches.track[0];

                var thumbnailImage = recognitionImageBuilder.buildThumbnailImage(song);
                recognitionList.addImageToCurrentSong(thumbnailImage);

                audioScrobbler.getAlbum(track.name, track.artist, function(json){
                    var track = json.track;
                    var album = track.album;
                  
                    if (album === undefined) {
                        album = {
                            title: "Unknown",
                            image: "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="
                        };
                    } else {
                        album.image = album.image[album.image.length - 1]["#text"];
                    }

                    var albumImage = recognitionImageBuilder.buildAlbumImage(album);
                    recognitionList.addImageToCurrentSong(albumImage);

                    //Whenever we successfully save to the server -- reflect that to the user
                    //by showing the song's duration and showing a nice animation.
                    backend.onSaveData(function(event, data){
                        var songDurationDiv = recognitionImageBuilder.buildSongDurationDiv(song);
                        recognitionList.addImageToCurrentSong(songDurationDiv);
                        recognitionList.showFinishedAnimation(data);
                    });

                    backend.saveData({
                        hoster: "youtube",
                        hosterid: song.id,
                        title: track.name,
                        artists: track.artist.name,
                        album: album.title,
                        cover: album.image,
                        id: track.id,
                        countries: song.restrictedCountries,
                        duration: song.duration,
                        artistsid: track.artist.mbid,
                        albumid: album.mbid
                    });
                });
            }
        });
    }

    function cropuntil(input, slice) {
        var croppedValue = input;

        if(input.indexOf(slice) !== -1) {
            croppedValue = input.substr(0, input.indexOf(slice));
        }

        return croppedValue;
    }

    //Any public methods which need to be returned.
    return {

    };
});