import os
from pathlib import Path

import toml

def get_config(config_path="/etc/torrpy/config.toml"):
    if os.path.isfile(config_path):
        config = toml.load(config_path)
        if set({"port",
                "download_path",
                "tmdb_language",
                "tmdb_key",
                "tv_folders",
                "movie_folders"}) <= set(config):
            return config
        
    config = {
        "port": 8042,
        "download_path": str(Path.home().joinpath("Download")),
        "tmdb_language": "fr",
        "tmdb_key": "",
        "tv_folders": [],
        "movie_folders": [],
    }
    with open(config_path, "w") as f:
        toml.dump(config, f)

    return config