import os
import pathlib
import shutil
from aiohttp import web
import aiohttp
import argparse

from config import get_config
import parser
import torrent

from torrent.exception import NoSpaceLeftException
import torrent.manager


arg_parser = argparse.ArgumentParser(
                    prog='TorrPy',
                    description='Torrent downloader')

arg_parser.add_argument('-c', '--config')
arg_parser.add_argument('-s', '--static')


static_path = None
config = None


args = arg_parser.parse_args()

if args.config is None:
    config = get_config("/etc/torrpy/config.toml")
else:
    config = get_config(args.config)
if args.static is None:
    static_path = "/usr/share/torrpy/static/"
else:
    static_path = args.static

def callback(path, data):
    new_name = None
    folder = None

    _, ext = os.path.splitext(path)
    size = os.stat(path).st_size

    if data["type"] == "movie":
        title = data["title"].replace(" ",".").replace("*","").lower()
        year = data["year"]
        tmdb_id = data["tmdb_id"]

        new_name = f"{title}.({year}).[tmdbid-{tmdb_id}]{ext}"
        folder = get_folder_by_size(size, config["movie_folders"])

    elif data["type"] == "tv":
        name = data["name"].replace(" ",".").replace("*","").lower()
        tmdb_id = data["tmdb_id"]
        year = data["year"]
        season = str(data["season"]).zfill(2)
        episode = str(data["episode"]).zfill(2)

        tv_path = f"{name}.({year}).[tmdbid-{tmdb_id}]"
        season_path = f"Season {season}"
        episode_path = f"{name}.S{season}E{episode}{ext}"

        new_name = os.path.join(tv_path, season_path, episode_path)
        folder = get_folder_by_size(size, config["tv_folders"])

    else:
        return
    
    new_path = pathlib.Path(os.path.join(folder, new_name))
    new_path.parents[0].mkdir(parents=True, exist_ok=True)

    shutil.copyfile(path, new_path)


def get_folder_by_size(size, folders):
    for folder in folders:
        _, _, free = shutil.disk_usage(folder)
        if size < free:
            return folder
    raise NoSpaceLeftException("no folders or free space")



manager = torrent.manager.Manager(config["download_path"], callback=callback)

    
async def index(request):
    return web.FileResponse(static_path+"/index.html")

async def get_torrent(request):
    info = manager.info(hash=request.rel_url.query.get('hash', None))
    if info is None:
        return web.json_response(
           data={"message": "torrent hash unknown"},
           status=404
       )
    return web.json_response(info)

async def put_torrent(request):
    hash=request.rel_url.query.get('hash', None)
    if hash is None:
        return web.json_response(
           data={"message": "hash is needed"},
           status=400
       )
    data = await request.json()
    if "pause" in data:
        manager.pause(hash, pause=data["pause"])
    if "position" in data:
        manager.set_position(hash, data["position"])
    if "priority" in data:
        for priority in data["priority"]:
            if "id" not in priority or "priority" not in priority:
                return web.json_response(
                    data={"message": "id and priority is needed for each"},
                    status=400
                )
            manager.set_priority(hash, priority["id"], priority["priority"])
    if "triggers" in data:
        for trigger in data["triggers"]:
            if "id" not in trigger:
                return web.json_response(
                    data={"message": "id is needed for each trigger"},
                    status=400
                )
            manager.set_trigger(hash, trigger)
    
    if "reset_triggers" in data:
        for id in data["reset_triggers"]:
            manager.reset_trigger(hash, id)
    
    return web.json_response({"message": "ok"})

async def post_torrent(request):
    if request.content_type == "application/json":
        magnet = await request.json()
        return web.json_response(await manager.add_magnet(magnet["uri"]))
    else:
        reader = await request.multipart()
        field = await reader.next()
        assert field.name == 'torrent'
        path = os.path.join(config["download_path"],".torrents", field.filename)
        with open(path, 'wb') as f:
            while True:
                chunk = await field.read_chunk()
                if not chunk:
                    break
                f.write(chunk)

        return web.json_response(manager.add_torrent(path))

async def delete_torrent(request):
    hash=request.rel_url.query.get('hash', None)
    if hash is None:
        return web.json_response(
           data={"message": "hash is needed"},
           status=400
       )
    
    manager.remove(hash)
    return web.json_response({"message": "ok"})

async def search_movie(request):
    title=request.rel_url.query.get('title', None)
    year=request.rel_url.query.get('year', None)
    page=request.rel_url.query.get('page', None)

    if title is None:
        return web.json_response(
           data={"message": "title is needed"},
           status=400
       )
    
    params = {
        "query": title,
        "language": config["tmdb_language"],
    }
    if year is not None:
        params["year"] = year
    if page is not None:
        params["page"] = page

    headers={"Authorization": config["tmdb_key"]}
    async with aiohttp.ClientSession(headers=headers) as session:
        async with session.get("https://api.themoviedb.org/3/search/movie", params=params) as resp:
            data = await resp.json()
            return web.json_response(data)

async def search_tv(request):
    name=request.rel_url.query.get('name', None)
    page=request.rel_url.query.get('page', None)

    if name is None:
        return web.json_response(
           data={"message": "name is needed"},
           status=400
       )
    
    params = {
        "query": name,
        "language": config["tmdb_language"],
    }
    if page is not None:
        params["page"] = page

    headers={"Authorization": config["tmdb_key"]}
    async with aiohttp.ClientSession(headers=headers) as session:
        async with session.get("https://api.themoviedb.org/3/search/tv", params=params) as resp:
            data = await resp.json()
            return web.json_response(data)

async def check_episode(request):
    id=request.rel_url.query.get('id', None)
    episode=request.rel_url.query.get('episode', None)
    season=request.rel_url.query.get('season', None)

    if id is None or episode is None or season is None:
        return web.json_response(
           data={"message": "id, episode and season is needed"},
           status=400
       )
    
    params = {
        "language": config["tmdb_language"],
    }

    request = f"https://api.themoviedb.org/3/tv/{id}/season/{season}/episode/{episode}"

    headers={"Authorization": config["tmdb_key"]}
    async with aiohttp.ClientSession(headers=headers) as session:
        async with session.get(request, params=params) as resp:
            data = await resp.json()
            return web.json_response(data, status=resp.status)

async def parse(request):
    data = await request.json()
    
    if "tv" in data:
        return web.json_response({"tv":list(map(parser.tv_name, data["tv"]))})
    
    if "movie" in data:
        return web.json_response({"movie":list(map(parser.movie_name, data["movie"]))})
    
    return web.json_response(
           data={"message": "function not found or unknown"},
           status=404
    )

async def free_space(request):
    _,_,download_free = shutil.disk_usage(config["download_path"])

    movie_free = 0
    for path in config["movie_folders"]:
        _,_,free = shutil.disk_usage(path)
        movie_free += free

    tv_free = 0
    for path in config["tv_folders"]:
        _,_,free = shutil.disk_usage(path)
        tv_free += free
    
    return web.json_response({
        "movie": movie_free,
        "download": download_free,
        "tv": tv_free,
    })


app = web.Application()
app.add_routes([web.static('/css', static_path+'/css'),
                web.static('/js', static_path+'/js'),
                web.static('/rsc', static_path+'/rsc'),
                web.get('/', index),
                web.get('/torrent', get_torrent),
                web.post('/torrent', post_torrent),
                web.put('/torrent', put_torrent),
                web.delete('/torrent', delete_torrent),
                web.get('/tmdb/search/movie', search_movie),
                web.get('/tmdb/search/tv', search_tv),
                web.get('/tmdb/episode', check_episode),
                web.post('/parse', parse),
                web.get('/freespace', free_space),
                ])
web.run_app(app, port=config["port"])
manager.close()
