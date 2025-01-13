var torrent_table;
var edit_table;
var search_movie_table;
var search_tv_episode_table;
var search_tv_table;

var edit_torrent_data = null;
var edit_torrent_movie = null;
var edit_torrent_tv = [];
var search_tv_selected = null;

var ext_video = [
    "webm",
    "mkv",
    "flv",
    "vob",
    "ogv",
    "ogg",
    "avi",
    "MTS",
    "M2TS",
    "TS",
    "mov",
    "wmv",
    "rm",
    "rmvb",
    "asf",
    "amv",
    "mp4",
    "m4p",
    "m4v",
    "mpg",
    "mp2",
    "mpeg",
    "mpe",
    "mpv",
    "m2v",
    "m4v",
    "svi",
    "3gp",
    "3g2",
    "mxf",

]


$( document ).ready(function() {
    refresh_freespace();
    window.setInterval(function(){
        refresh_freespace();
    }, 10*60*1000);

    InitTorrentTable();
    InitModalEdit();
    InitModalUpload();
    InitModalSearchMovie();
    InitModalSearchTv();
    InitModalAlert();

    $("#adding").on( "click", function(){$('#modal-upload').iziModal('open')});

    $('#search').on('input',function(e){
        torrent_table.setFilter("name", "keywords", $("#search").val(), {matchAll:true});
    });

    
});

function refresh_freespace(){
    axios.get("/freespace")
    .then(function (response) {
        $("#free-download").text(humanFileSize(response.data.download))
        $("#free-movie").text("movie: "+humanFileSize(response.data.movie))
        $("#free-tv").text("tv: "+humanFileSize(response.data.tv))
        
    })
    .catch(function (error) {
        open_alert_error("refresh freespace", error);
    })
}

function InitTorrentTable(){
    torrent_table = new Tabulator("#torrent-table", {
        selectableRows:true,
        selectableRowsRangeMode:"click",
        layout:"fitDataFill",
        resizableColumnFit:true,
        responsiveLayout:true,
        index:"hash",
        rowContextMenu: [
            {
                label:"Edit",
                action:function(e, row){
                    var data = row.getData();
                    open_modal_edit_torrent(data.hash);
                }
            },
            {
                separator: true
            },
            {
                label:"Delete",
                action:function(e, row){
                    var selectedData;
                    if (row.isSelected()){
                        selectedData = row.getTable().getSelectedData();
                    }
                    else{
                        selectedData = row.getData();
                    }
                    delete_torrent(selectedData);
                }
            },
            {
                label:"Pause",
                action:function(e, row){
                    var selectedData;
                    if (row.isSelected()){
                        selectedData = row.getTable().getSelectedData();
                    }
                    else{
                        selectedData = row.getData();
                    }
                    pause_torrent(selectedData, true);
                }
            },
            {
                label:"Resume",
                action:function(e, row){
                    var selectedData;
                    if (row.isSelected()){
                        selectedData = row.getTable().getSelectedData();
                    }
                    else{
                        selectedData = row.getData();
                    }
                    pause_torrent(selectedData, false);
                }
            },
            {
                separator: true
            },
            {
                label:"Selection",
                menu:[
                    {
                        label:"Select all",
                        action:function(e, row){
                            row.getTable().selectRow("visible");
                        }
                    },
                    {
                        label:"Deselect all",
                        action:function(e, row){
                            row.getTable().deselectRow();
                        }
                    },
                ]
            },
            
        ],
        columns:[
            {title:"#", field:"position", responsive:2},
            {title:"Added", field:"added", responsive:3, formatter: function(cell, formatterParams, onRendered) {
                try {
                  let dt = luxon.DateTime.fromSeconds(cell.getValue());
                  return dt.toFormat(formatterParams.outputFormat);
                } catch (error) {
                  return formatterParams.invalidPlaceholder;
                }
              },
            formatterParams: {
                outputFormat: "dd/MM/yy HH:mm",
                invalidPlaceholder: "(invalid date)"
            }},
            {title:"Size", field:"size", responsive:3, formatter:function(cell, formatterParams, onRendered){
                if (cell.getValue()){
                    return humanFileSize(cell.getValue()); 
                }
                return "0 B"
            }},
            {title:"Progress", field:"progress", responsive:0, width:150, formatter:"progress", formatterParams:{
                min:0.0,
                max:1.0,
                legend:function(value){return (value*100).toFixed(1) + "%"},
            }},
            {title:"Remaining", field: "size_downloaded", responsive:2, mutator:function(value, data){
                if (data.progress == 1.0){
                    return 0
                }
                if (data.download_rate > 0){
                    return (data.size-data.size_downloaded) / data.download_rate;
                }
                return -1
            }, formatter:function(cell, formatterParams, onRendered){
                if (cell.getValue() == 0){
                    return "completed"
                }
                else if(cell.getValue() == -1){
                    return "infinity"
                }
                return humantTime(cell.getValue()*1000); 
            }},
            {title:"Rate", field:"download_rate", responsive:3, formatter:function(cell, formatterParams, onRendered){
                value = cell.getValue();
                if (value && value > 1000){
                    return humanFileSize(cell.getValue())+"/s"; 
                }
                return "0.0 kb/s"
            }},
            {title:"Uploaded", field:"size_uploaded", responsive:3, formatter:function(cell, formatterParams, onRendered){
                if (cell.getValue()){
                    return humanFileSize(cell.getValue()); 
                }
                return "0 B"
            }},
            {title:"State", field:"state", responsive:3},
            {title:"Trigger", field:"trigger", responsive:1},
            {title:"Name", field:"name", responsive:0}
        ],
        rowFormatter:function(row){
            // var video = row.getData();
            // if (row.isSelected()){
            //     row.getElement().style.backgroundColor = "rgba(249,105,14, 0.4)"
            // }else if (video.media_id == null){
            //     row.getElement().style.backgroundColor = "rgba(255,0,0, 0.4)"
            // }else if (video.media_type == 0){
            //     row.getElement().style.backgroundColor = "rgba(135, 211, 124, 0.4)"
            // }else if (video.media_type == 1){
            //     row.getElement().style.backgroundColor = "rgba(137, 196, 244, 0.4)"
            // }else{

            // }   
        },
    });

    torrent_table.on("rowDblClick", function(e, row){
       var data = row.getData();
       open_modal_edit_torrent(data.hash);
    });

    axios.get("/torrent")
    .then(function (response) {
        if (response.data.torrents.length > 0){
            torrent_table.replaceData(response.data.torrents);
        }
        else{
            console.log(response.data)
        }
        
    })
    .catch(function (error) {
        open_alert_error("refresh torrent", error);
    })

    window.setInterval(function(){
        axios.get("/torrent")
        .then(function (response) {
            if (response.data.torrents.length > 0){
                torrent_table.updateData(response.data.torrents);
            }
            else{
                console.log(response.data)
            }
        })
        .catch(function (error) {
            open_alert_error("refresh torrent", error);
        })
    }, 5000);
}

function delete_torrent(array, confirmed=false){
    if(!confirmed && !confirm('Are you sure you want to delete the torrents?')) {
        return
    }
    var torrentData;
    if (Array.isArray(array)){
        torrentData = array.pop();
    }
    else{
        torrentData = array;
    }
    axios.delete('/torrent?hash='+torrentData.hash)
    .then(function (response) {
        torrent_table.deleteRow(torrentData.hash);
        console.log("delete torrent: "+torrentData.name);
    })
    .catch(function (error) {
        open_alert_error("delete ("+torrentData.name+")", error.message);
    })
    .finally(function () {
        if (Array.isArray(array)){
            if(array.length>0){
                delete_torrent(array, true);
            }
        }
    });
}

function pause_torrent(array, value){
    var torrentData;
    if (Array.isArray(array)){
        torrentData = array.pop();
    }
    else{
        torrentData = array;
    }
    axios.put('/torrent?hash='+torrentData.hash,{pause:value})
    .then(function (response) {
        console.log("pause torrent: "+torrentData.name);
    })
    .catch(function (error) {
        open_alert_error("pause ("+torrentData.name+")", error);
    })
    .finally(function () {
        if (Array.isArray(array)){
            if(array.length>0){
                pause_torrent(array, value);
            }
        }
    });
}

function InitModalUpload(){
    $('#modal-upload').iziModal({
        title: 'Upload torrent',
        icon: "icon-home",
        zindex: 2001,
        loop: true,
        onClosed: function(){
            $("#modal-upload-file").val(null);
            $("#modal-upload-magnet").val(null);
        },
    });

    $( "#modal-upload-validate" ).on( "click", function() {
        var data = null;
        
        if($('#modal-upload-file').val()){
            data= new FormData();
            data.append('torrent', $('#modal-upload-file').prop('files')[0]);
        }
        else if($('#modal-upload-magnet').val()){
            data = {uri: $('#modal-upload-magnet').val()}
        }
        else{
            return
        }
        axios.post('torrent', data)
        .then(function (response) {
            $('#modal-upload').iziModal('close', {
                transition: 'bounceOutDown'
            });
            axios.get("/torrent")
            .then(function (response) {
                if (response.data.torrents.length > 0){
                    torrent_table.replaceData(response.data.torrents);
                }
                else{
                    console.log(response.data)
                }
                
            })
            .catch(function (error) {
                open_alert_error("refresh torrent", error);
            })
            new_modal_edit_torrent(response.data);
        })
        .catch(function (error) {
            open_alert_error("upload failed", error.message);
        });
    });
}

function InitModalEdit(){
    $('#modal-edit').iziModal({
        title: 'Edit torrent',
        icon: "icon-home",
        width: "80%",
        zindex: 2001,
        loop: true,
        onClosed: function(){
            edit_torrent_data = null;
            edit_table.replaceData([]);
        },
    });

    edit_table = new Tabulator("#modal-edit-table", {
        selectableRows:true,
        selectableRowsRangeMode:"click",
        layout:"fitDataStretch",
        responsiveLayout:true,
        index:"id",
        rowContextMenu: [
            {
                label:"Activate",
                action:function(e, row){
                    var selectedData;
                    if (row.isSelected()){
                        selectedData = row.getTable().getSelectedData();
                    }
                    else{
                        selectedData = [row.getData()];
                    }
                    selectedData = selectedData.map((data) => {
                        data.priority = 4;
                        return data;
                    });
                    set_priority_files_torrent(selectedData);
                    row.getTable().updateData(selectedData);
                }
            },
            {
                label:"Deactivate",
                action:function(e, row){
                    var selectedData;
                    if (row.isSelected()){
                        selectedData = row.getTable().getSelectedData();
                    }
                    else{
                        selectedData = [row.getData()];
                    }
                    selectedData = selectedData.map((data) => {
                        data.priority = 0;
                        return data;
                    });
                    set_priority_files_torrent(selectedData);
                    row.getTable().updateData(selectedData);
                }
            },
            {
                label:"Delete trigger",
                action:function(e, row){
                    var selectedData;
                    if (row.isSelected()){
                        selectedData = row.getTable().getSelectedData();
                    }
                    else{
                        selectedData = [row.getData()];
                    }
                    console.log()
                    delete_triggers(selectedData);

                }
            },
            {
                label:"Tv",
                action:function(e, row){
                    var selectedData;
                    if (row.isSelected()){
                        selectedData = row.getTable().getSelectedData();
                    }
                    else{
                        selectedData = [row.getData()];
                    }
                    open_modal_search_tv(selectedData);
                }
            },
            {
                label:"Movie",
                action:function(e, row){
                    open_modal_search_movie( row.getData());
                }
            },
            {
                separator: true
            },
            {
                label:"Selection",
                menu:[
                    {
                        label:"Select all",
                        action:function(e, row){
                            row.getTable().selectRow("visible");
                        }
                    },
                    {
                        label:"Select video",
                        action:function(e, row){
                            var table = row.getTable();
                            table.selectRow(table.getRows().filter(row => ext_video.includes(row.getData().path.split('.').pop())));
                        }
                    },
                    {
                        label:"Deselect all",
                        action:function(e, row){
                            row.getTable().deselectRow();
                        }
                    },
                ]
            },
        ],
        columns:[
            {title:"#", field:"priority", responsive:2, editor:"number", editorParams:{
                min:0,
                max:10,
                step:1,
            }, cellEdited:function(cell){
                set_priority_files_torrent(cell.getRow().getData());
            }},
            {title:"Path", field:"path",  responsive:0, formatter:function(cell, formatterParams, onRendered){
                var path = cell.getValue();
                return path.substring(path.lastIndexOf('/')+1);
            }, tooltip:true},
            {title:"Size", field:"size", responsive:3, formatter:function(cell, formatterParams, onRendered){
                if (cell.getValue()){
                    return humanFileSize(cell.getValue()); 
                }
                return "0 B"
            }},
            {title:"Downloaded", field:"size_downloaded", responsive:3, formatter:function(cell, formatterParams, onRendered){
                if (cell.getValue()){
                    return humanFileSize(cell.getValue()); 
                }
                return "0 B"
            }},
            {title:"Trigger", field:"trigger", responsive:0, formatter:function(cell, formatterParams, onRendered){
                cell.getElement().style.whiteSpace = "pre-wrap";
                if (cell.getValue() == null){
                    return this.emptyToSpace("");
                }
                const trigger = cell.getValue();
                const data = trigger.data;
                if (data.type == "movie"){
                    var info = '<a href="https://www.themoviedb.org/movie/'+data.tmdb_id+'" target="_blank">'+data.title+' - '+data.year+'</a>'
                    info = info+" - "+trigger_state_to_string(trigger);
                    return this.emptyToSpace(info);
                }
                else if (data.type == "tv"){
                    var info = '<a href="https://www.themoviedb.org/tv/'+data.tmdb_id+'" target="_blank">'+data.name+' S'+padZero(data.season)+'E'+padZero(data.episode)+'</a>'
                    info = info+" - "+trigger_state_to_string(trigger);
                    return this.emptyToSpace(info);
                }
                return this.emptyToSpace("None or Unknown");
            }},
        ],
    });

    $('#modal-edit-position-bottom').on( "click", function() {
        axios.put("/torrent?hash="+edit_torrent_data.hash, {position:"bottom"}).catch(function (error) {
            open_alert_error("edit position error", error);
        });
    } );

    $('#modal-edit-position-down').on( "click", function() {
        axios.put("/torrent?hash="+edit_torrent_data.hash, {position:"down"}).catch(function (error) {
            open_alert_error("edit position error", error);
        });
    } );

    $('#modal-edit-position-up').on( "click", function() {
        axios.put("/torrent?hash="+edit_torrent_data.hash, {position:"up"}).catch(function (error) {
            open_alert_error("edit position error", error);
        });
    } );

    $('#modal-edit-position-top').on( "click", function() {
        axios.put("/torrent?hash="+edit_torrent_data.hash, {position:"top"}).catch(function (error) {
            open_alert_error("edit position error", error);
        });
    } );

    $( "#modal-edit-pause" ).on( "click", function() {
        pause_torrent(edit_torrent_data, edit_torrent_data.State != "paused");
    });

    $( "#modal-edit-delete" ).on( "click", function() {
        delete_torrent(edit_torrent_data);
        $('#modal-edit').iziModal('close', {
            transition: 'bounceOutDown'
        });
    });

    window.setInterval(function(){
        refresh_modal_edit_torrent()
    }, 10000);
}

function open_modal_edit_torrent(hash){
    axios.get("/torrent?hash="+hash)
    .then(function (response) {
        new_modal_edit_torrent(response.data);
    })
    .catch(function (error) {
        open_alert_error("open", error);
    })
}

function new_modal_edit_torrent(data){
    edit_torrent_data = data;
    update_modal_edit_torrent();
    edit_table.replaceData(edit_torrent_data.files);
    $('#modal-edit').iziModal('open');
}

function refresh_modal_edit_torrent(){
    if (edit_torrent_data != null){
        axios.get("/torrent?hash="+edit_torrent_data.hash)
        .then(function (response) {
            edit_torrent_data = response.data;
            update_modal_edit_torrent();
            edit_table.updateData(edit_torrent_data.files);
        })
        .catch(function (error) {
            open_alert_error("refresh info", error);
        })               
    }
}

function update_modal_edit_torrent(){
    $('#modal-edit-name').text(edit_torrent_data.name);
    $('#modal-edit-hash').text(edit_torrent_data.hash);
    $('#modal-edit-size').text(humanFileSize(edit_torrent_data.size));
    $('#modal-edit-size-up').text(humanFileSize(edit_torrent_data.size_uploaded));
    $('#modal-edit-size-down').text(humanFileSize(edit_torrent_data.size_downloaded));
    $('#modal-edit-state').text(edit_torrent_data.state);
    $('#modal-edit-seed').text(edit_torrent_data.peers+"/"+edit_torrent_data.seeds);
    $('#modal-edit-rate-up').text(humanFileSize(edit_torrent_data.upload_rate));
    $('#modal-edit-rate-down').text(humanFileSize(edit_torrent_data.download_rate));
    $('#modal-edit-position').val(edit_torrent_data.position);
    if (edit_torrent_data.position < 0){
        $("#modal-edit-position").prop('disabled', true);
    }
    if (edit_torrent_data.state == "paused"){
        $("#modal-edit-pause").text("Resume");
    }
    else{
        $("#modal-edit-pause").text("Pause");
    }
}

function trigger_state_to_string(trigger){
    if (trigger.state == 0){
        return "created"; 
    }
    else if (trigger.state == 1){
        return "pending"; 
    }
    else if (trigger.state == 2){
        return "working..."; 
    }
    else if (trigger.state == 3){
        return "finished"; 
    }
    else if (trigger.state == -1){
        return "error(no callback)"; 
    }
    else if (trigger.state == -2){
        return "error(no space left)"; 
    }
    else if (trigger.state == -3){
        return "error(trigger data)"; 
    }
    else if (trigger.state == -4){
        return "error(unknown)"; 
    }
    else{
        return "error("+trigger.state+")"
    }
}

function set_priority_files_torrent(dataSet){
    if (!Array.isArray(dataSet)){
        dataSet = [dataSet];
    }
    var json = {priority: []};
    dataSet.forEach(function(data){
        json.priority.push({id: data.id, priority:data.priority});
    });
    axios.put("/torrent?hash="+edit_torrent_data.hash, json).catch(function (error) {
        open_alert_error("edit priority error", error);
    });
}

function delete_triggers(dataSet){
    if (!Array.isArray(dataSet)){
        dataSet = [dataSet];
    }

    var json = {reset_triggers: []};
    dataSet.forEach(function(data){
        json.reset_triggers.push(data.id);
    });
    axios.put("/torrent?hash="+edit_torrent_data.hash, json).then(function(response){
        refresh_modal_edit_torrent();
    }).catch(function (error) {
        open_alert_error("edit rest trigger error", error);
    });
}

function InitModalSearchMovie(){
    $('#modal-search-movie').iziModal({
        title: 'Recherche de Film sur tmdb',
        icon: "icon-home",
        width: 800,
        zindex: 3001,
        loop: true,
        onClosed: function(){
            edit_torrent_movie = null;
            search_movie_table.replaceData([]);
            $('#modal-search-movie-input').val("");
            $('#modal-search-movie-year-input').val("");

        },
    });

    search_movie_table = new Tabulator("#modal-search-movie-table", {
        layout:"fitDataStretch",
        rowHeight: "233px",
        columns:[
            {title:"Poster", field:"poster_path", formatter:"image", formatterParams:{
                height: "231px",
                width: "154px",
                urlPrefix:"https://image.tmdb.org/t/p/w154",
            }},
            {title:"Overview", field:"overview", variableHeight:true, formatter:function(cell, formatterParams, onRendered){
                cell.getElement().style.whiteSpace = "pre-wrap";
                return this.emptyToSpace(cell.getValue());
            }, mutator:function(value, data, type, params, component){
                year = data.release_date.substring(0, 4);
                title = data.title;
                
                return "<h5>"+title + " - " + year +"</h5> <p>" + value + "</p>"
            }},
        ],
    });
  
    search_movie_table.on("rowDblClick", function(e, row){
        movie = row.getData();
        if (edit_torrent_movie != null){
            axios.put("/torrent?hash="+edit_torrent_data.hash, {
                triggers:[
                    {
                        id:edit_torrent_movie.id,
                        type:"movie",
                        title:movie.title,
                        year:movie.release_date.substring(0, 4),
                        tmdb_id:movie.id,
                    },
                ]
            })
            .then(function (response) {
                refresh_modal_edit_torrent()
                $('#modal-search-movie').iziModal('close');
            })
            .catch(function (error) {
                $('#modal-search-movie').iziModal('close');
                open_alert_error("edit movie trigger error", error);
            });
        }
    });

    $('#modal-search-movie-validate').on( "click", function() {
        var params = {
            title: $('#modal-search-movie-input').val(),
        };
    
        var year = $('#modal-search-movie-year-input').val()
        if (year.length > 0){
            params.year = year;
        }
        axios.get('/tmdb/search/movie', {params})
        .then(function (response) {
            if (response.data.results.length == 0){
                open_alert_error("0 results", "");
            }
            search_movie_table.replaceData(response.data.results)
            
        })
        .catch(function (error) {
            open_alert_error("edit position error", error);
        });
    });
}

function open_modal_search_movie(file_info){
    edit_torrent_movie = file_info
    
    var path = edit_torrent_movie.path;
    var name = path.substring(path.lastIndexOf('/')+1);
    $('#modal-search-movie-title').text(name);

    axios.post("/parse",{movie:[name]})
    .then(function (response) {
        if(response.data.movie[0].title){
            $('#modal-search-movie-input').val(response.data.movie[0].title.replace(".", " "));
            if(response.data.movie[0].year){
                $('#modal-search-movie-year-input').val(response.data.movie[0].year);
            }
            $('#modal-search-movie-validate').click();
        } 
    })
    .catch(function (error) {
        open_alert_error("parse error", error);
    })
    .finally(function () {
        $('#modal-search-movie').iziModal('open');
    });
}

function InitModalSearchTv(){
    $('#modal-search-tv').iziModal({
        title: 'Recherche de Tv Show sur tmdb',
        icon: "icon-home",
        width: 800,
        zindex: 3001,
        loop: true,
    });

    search_tv_table = new Tabulator("#modal-search-tv-table", {
        layout:"fitDataStretch",
        rowHeight: "233px",
        columns:[
            {title:"Poster", field:"poster_path", formatter:"image", formatterParams:{
                height: "231px",
                width: "154px",
                urlPrefix:"https://image.tmdb.org/t/p/w154",
            }},
            {title:"Overview", field:"overview", variableHeight:true, formatter:function(cell, formatterParams, onRendered){
                cell.getElement().style.whiteSpace = "pre-wrap";
                return this.emptyToSpace(cell.getValue());
            }, mutator:function(value, data, type, params, component){
                return "<h5>"+data.name+"</h5>"+data.first_air_date+"<p>" + value + "</p>"
            }},
        ],
    });
  
    search_tv_table.on("rowDblClick", function(e, row){
        search_tv_selected = row.getData();
        $('#modal-search-tv-episode-poster').attr("src","https://image.tmdb.org/t/p/w154"+search_tv_selected.poster_path);
        $('#modal-search-tv-overview').html(search_tv_selected.overview);
        $('#modal-search-tv').iziModal('close');
        verify_modal_search_episode();
    });

    $('#modal-search-tv-validate').on( "click", function() {
        var params = {
            name: $('#modal-search-tv-input').val(),
        };

        axios.get('/tmdb/search/tv', {params})
        .then(function (response) {
            if (response.data.results.length == 0){
                open_alert_error("0 results", "");
            }
            search_tv_table.replaceData(response.data.results)
            
        })
        .catch(function (error) {
            open_alert_error("edit position error", error);
        });
    });

    $('#modal-search-tv-episode').iziModal({
        title: 'Recherche tmdb Tv Episode',
        icon: "icon-home",
        width: "80%",
        zindex: 3000,
        loop: true,
        onClosed: function(){
            search_tv_selected = null;
            $('#modal-search-tv-input').val("");
            search_tv_table.replaceData([]);
            $('#modal-search-tv-episode-poster').attr("src","/rsc/poster_empty.jpg");
            $('#modal-search-tv-overview').html("");
        },
    });

    search_tv_episode_table = new Tabulator("#modal-search-tv-episode-table", {
        selectableRows:true,
        selectableRowsRangeMode:"click",
        layout:"fitDataStretch",
        layoutColumnsOnNewData:true,
        index:"id",
        rowContextMenu: [
            {
                label:"Delete",
                action:function(e, row){
                    table.deleteRow(row.getIndex());
                }
            },
        ],
        columns:[
            {title:"Season", field:"season", editor:"number"},
            {title:"Episode", field:"episode", editor:"number"},
            {title:"Path", field:"path",  responsive:0, formatter:function(cell, formatterParams, onRendered){
                var path = cell.getValue();
                return path.substring(path.lastIndexOf('/')+1);
            }, tooltip:true},
        ],
        rowFormatter:function(row){
            var data = row.getData();
            if(!data.valide){
                row.getElement().style.backgroundColor = "rgba(255,0,0, 0.4)";
            }

            else{
                row.getElement().style.backgroundColor = "rgba(135, 211, 124, 0.4)";
            }
        },
    });

    search_tv_episode_table.on("cellEdited", function(cell){
        verify_modal_search_episode([cell.getRow().getData()]);
    });

    $("#modal-search-tv-episode-ok").click(function (){
        for (const row of search_tv_episode_table.getData()){
            if (!row.valide){
                return
            }
        }
        send_tv_trigger(search_tv_episode_table.getData());
        $('#modal-search-tv-episode').iziModal('close');
    });
    
    $("#modal-search-tv-episode-search").click(function (){
        $('#modal-search-tv').iziModal('open');
    });


    $("#modal-search-tv-episode-force").click(function (){
        send_tv_trigger(search_tv_episode_table.getData());
    });

    $("#modal-search-tv-season-set").click(function (){
        var season = $('#modal-search-tv-season-input').val();
        var data = search_tv_episode_table.getData();
        for (let i = 0; i < data.length; i++){
            data[i].season = parseInt(season);
        }
        search_tv_episode_table.updateData(data);

    });
}

function open_modal_search_tv(infos){
    var data = {
        tv:[],
    }
    for (const info of infos){
        data.tv.push(info.path.substring(info.path.lastIndexOf('/')+1));
    }
    axios.post("/parse",data)
    .then(function (response) {
        for (let i = 0; i < infos.length; i++) {
            if (response.data.tv[i].season){
                infos[i].season = response.data.tv[i].season;
            }
            else{
                infos[i].season =  -1;
            }
            if (response.data.tv[i].episode){
                infos[i].episode = response.data.tv[i].episode;
            }
            else{
                infos[i].episode =  -1;
            }
            infos[i].valide = false;
        }
        if (response.data.tv[0].name){
            $('#modal-search-tv-input').val(response.data.tv[0].name);
            var params = {
                name: response.data.tv[0].name,
            };
            axios.get('/tmdb/search/tv', {params})
            .then(function (response) {
                if (response.data.results.length == 0){
                    open_alert_error("0 results", "");
                }
                search_tv_table.replaceData(response.data.results);
                search_tv_selected = response.data.results[0];
                $('#modal-search-tv-episode-poster').attr("src","https://image.tmdb.org/t/p/w154"+search_tv_selected.poster_path);
                $('#modal-search-tv-overview').html(search_tv_selected.overview);
                verify_modal_search_episode();
                
            }) .finally(function () {
                $('#modal-search-tv-episode').iziModal('open');
            });
        }
        else{
            $('#modal-search-tv-episode').iziModal('open');
        }

    })
    .catch(function (error) {
        for (let i = 0; i < infos.length; i++) {
            infos[i].season =  -1;
            infos[i].episode =  -1;
            infos[i].valide = false;
        }
        $('#modal-search-tv-episode').iziModal('open');
    })
    .finally(function () {
        search_tv_episode_table.replaceData(infos);
        
    });
}

function verify_modal_search_episode(rows=null){
    if (search_tv_selected == null){
        return 
    }

    if (rows == null){
        rows = search_tv_episode_table.getData();
    }

    var row = rows.pop();
    const params = {
        id: search_tv_selected.id,
        season: row.season,
        episode: row.episode,
    }

    axios.get("/tmdb/episode", {params, })
    .then(function (response) {
        row.valide = true;
        search_tv_episode_table.updateData([row]);
    })
    .catch(function (error) {
        row.valide = false;
        search_tv_episode_table.updateData([row]);
        $("#modal-search-tv-episode-ok").prop("disabled", true);
    })
    .finally(function () {
        if(rows.length>0){
            verify_modal_search_episode(rows);
        }
        else{
            for (const row of search_tv_episode_table.getData()){
                if (!row.valide){
                    return
                }
            }
            $("#modal-search-tv-episode-ok").prop("disabled", false);
        }
    });
}

function send_tv_trigger(rows){

    if (edit_torrent_data == null || search_tv_selected == null){
        open_alert_error("send tv trigger", "edit_torrent_data or search_tv_selected is null");
        return 
    } 

    const params = {
        hash: edit_torrent_data.hash,
    }

    var data = {
        triggers: []
    }

    for(const row of rows){
        data.triggers.push({
                        id:row.id,
                        type:"tv",
                        name:search_tv_selected.name,
                        tmdb_id: search_tv_selected.id,
                        year:search_tv_selected.first_air_date.substring(0, 4),
                        season:row.season,
                        episode:row.episode,
                    });
    }

    axios.put("/torrent", data, {params})
    .then(function (response) {
        refresh_modal_edit_torrent()
        $('#modal-search-tv-episode').iziModal('close');
    })
    .catch(function (error) {
        $('#modal-search-tv-episode').iziModal('close');
        open_alert_error("edit tv trigger error", error);
    });
}

function InitModalAlert(){
    $("#modal-alert-error").iziModal({
        title: "Unknown Error",
        icon: 'icon-check',
        headerColor: '#ff0000',
        width: 600,
        timeout: 10000,
        timeoutProgressbar: true,
        transitionIn: 'fadeInUp',
        transitionOut: 'fadeOutDown',
        zindex: 5001,
        bottom: 0,
        loop: true,
        pauseOnHover: true
    });

    $("#modal-alert-info").iziModal({
        title: "Unknown Info",
        icon: 'icon-check',
        headerColor: ' #0000FF',
        width: 600,
        timeout: 3000,
        timeoutProgressbar: true,
        transitionIn: 'fadeInUp',
        transitionOut: 'fadeOutDown',
        zindex: 5001,
        bottom: 0,
        loop: true,
        pauseOnHover: true
    });
}

function open_alert_error(type, error){
    $("#modal-alert-error").iziModal('setTitle',type+" : "+error);
    $("#modal-alert-error").iziModal('open');
    console.log(type,error);
}

function open_alert_info(info){
    $("#modal-alert-info").iziModal('setTitle',info);
    $("#modal-alert-info").iziModal('open');
    console.log(info);
}

function humanFileSize(size) {
    var i = size == 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
    return (size / Math.pow(1024, i)).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
  }
  
function humantTime(ms) {
    const seconds = Math.floor(Math.abs(ms / 1000))
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.round(seconds % 60)
    const t = [h, m > 9 ? m : h ? '0' + m : m || '0', s > 9 ? s : '0' + s]
        .filter(Boolean)
        .join(':')
    return ms < 0 && seconds ? `-${t}` : t
}

function padZero(number){
    var numString = number.toString();
    return numString.padStart(2, "0");
}