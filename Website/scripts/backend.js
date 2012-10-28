define(function(){
    'use strict';
    var url = 'http://songbuzz.host56.com/backend/songs/add.php';
    
    var events = {
        onSaveData: 'onSaveData'
    };
    return {
        saveData: function(data){
            var self = this;
            $.ajax({
                url: url,
                data: data,
                dataType: "json",
                // [Meo] TODO: This function is called success, yet it checks the result of success. Why?
                // [Jonny] It checks if there was a database error.
                success: function(json) {
                    if (json.success === "true") {
                        $(self).trigger(events.onSaveData, data);
                    }
                }
            });
        },
        onSaveData: function(event){
            $(this).bind(events.onSaveData, event);
        }    
    };
});

