import re

tv_pattern = re.compile(r"^(\[.*\][\._\s])?(.*)[\._\s]([sS])?(\d{1,3})[xXeE](\d{1,3})([\._\s].*)?(\..*)$")
tv_pattern2 = re.compile(r"^(\[.*\][\._\s])?(.*)[\._\s][eE](\d{1,3})([\._\s].*)?(\..*)$")
tv_pattern3 = re.compile(r"^(\[.*\][\._\s])?(.*)[\._\s](\d{1,3})([\._\s].*)?(\..*)$")
movie_pattern = re.compile(r"^(\[.*\][\._\s])?(.*)[\._\s]([12][019][0-9][0-9])([\._\s].*)?(\..*)$")
movie_pattern2 = re.compile(r"^(\[.*\][\._\s])?(.*)([\._\s].*)?(\..*)$")

def tv_name(name):
    ret = {}
    match = tv_pattern.match(name)
    if match is not None:
        ret["name"] = match.group(2).replace(".", " ")
        ret["season"] = int(match.group(4))
        ret["episode"] = int(match.group(5))
        return ret
    match = tv_pattern2.match(name)
    if match is not None:
        ret["name"] = match.group(2).replace(".", " ")
        ret["season"] = 1
        ret["episode"] = int(match.group(3))
        return ret
    match = tv_pattern3.match(name)
    if match is not None:
        ret["name"] = match.group(2).replace(".", " ")
        ret["season"] = 1
        ret["episode"] = int(match.group(3))
        return ret
    return ret
         
def movie_name(name):
    ret = {}
    match = movie_pattern.match(name)
    if match is not None:
        ret["title"] = match.group(2).replace(".", " ")
        ret["year"] = int(match.group(3))
        return ret
    match = movie_pattern2.match(name)
    if match is not None:
        ret["title"] = match.group(2).replace(".", " ")
        return ret
    return ret
    