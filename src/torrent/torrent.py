import base64
import os
import pathlib
import shutil
import libtorrent as lt

from torrent.exception import TriggerDataException

class Triggers:
    def __init__(self, file_count, old_triggers=None):
        if old_triggers is None:
            old_triggers = []

        self.triggers = old_triggers
        self.file_count = file_count
        for trigger in self.triggers:
            if 0 < trigger["state"] < 3:
                trigger["state"] = 0
    
    def get(self, id):
        for trigger in self.triggers:
            if trigger["id"] == id:
                return trigger
    
    def ids(self):
        ret = []
        for trigger in self.triggers:
            ret.append(trigger["id"])
        return ret
    
    def json(self):
        return self.triggers
    
    def short(self):
        count = len(self.triggers)
        completed = 0
        for trigger in self.triggers:
            if trigger["state"] == 3:
                completed += 1
        
        if count == 0:
            return "none"
        if count == completed:
            return "completed"
        return "{}/{}".format(completed, count)
    
    def add(self, data):
        self.check(data)

        trigger = self.get(data["id"])
        if trigger is not None:
            self.triggers.remove(trigger)
        
        self.triggers.append({
            "id": data["id"],
            "data": data,
            "state": 0,
        })
    
    def update(self, id, state):
        trigger = self.get(id)
        if trigger is None:
            raise TriggerDataException("file ID incorrect")
        
        trigger["state"] = state
    
    def check(self, data):
        if "id" not in data:
            raise TriggerDataException("missing key(id)")
        if data["id"] >= self.file_count:
            raise TriggerDataException("file ID incorrect")
        if "type" not in data:
            raise TriggerDataException("missing key(type)")
        if data["type"] == "tv":
            if not "name" in data: 
                raise TriggerDataException("missing key(name)")
            if not "season" in data: 
                raise TriggerDataException("missing key(season)")
            if not "episode" in data: 
                raise TriggerDataException("missing key(episode)")
            if not "tmdb_id" in data: 
                raise TriggerDataException("missing key(tmdb_id)")
        elif data["type"] == "movie":
            if not "title" in data: 
                raise TriggerDataException("missing key(title)")
            if not "year" in data: 
                raise TriggerDataException("missing key(year)")
            if not "tmdb_id" in data: 
                raise TriggerDataException("missing key(tmdb_id)")
        else:
            raise TriggerDataException("unknown type("+data["type"]+")")

    
class Torrent:
    def __init__(self, handle, data=None, triggers=None) -> None:
        self.handle = handle
        self.name = handle.name()
        self.path =  os.path.join(handle.save_path(), handle.name())
        self.hash = str(handle.info_hash())
        if triggers is None:
            triggers = []
        self.triggers = Triggers(self.handle.get_torrent_info().files().num_files(), triggers)
        self.data = data
    
    def completed(self):
        return self.handle.status().progress == 1.0
    
    def trigger(self, id):
        return self.triggers.get(id)
    
    def trigger_ids(self):
        return self.triggers.ids()
    
    def fast_resume(self):
        return {
            "save_path": self.handle.save_path(), 
            "data":  self.data, 
            "triggers": self.triggers.json()}
    
    def file_path(self, id):
        return pathlib.Path(os.path.join(self.handle.save_path(),self.handle.get_torrent_info().files().file_path(id))).resolve()
    
    def info(self):
        s = self.handle.status()
        return {
            "name": self.name,
            "hash": self.hash,
            "added": s.added_time,
            "position": s.queue_position,
            "progress": s.progress,
            "size": s.total_wanted,
            "size_downloaded": s.total_wanted_done,
            "download_rate": s.download_rate,
            "size_uploaded": s.all_time_upload,
            "state": gen_state(self.handle, s.state),
            "trigger": self.triggers.short()}
    
    def full_info(self):
        s = self.handle.status()
        ret_files = []
        files = self.handle.get_torrent_info().files()
        size_downloaded = self.handle.file_progress()
        for i in range(0, files.num_files()):
            ret_files.append({
                "id": i, 
                "path": files.file_path(i), 
                "priority": self.handle.file_priority(i),
                "size": files.file_size(i),
                "size_downloaded": size_downloaded[i],
                "trigger": self.triggers.get(i),
                })
        return{
            "name": self.name,
            "hash": self.hash,
            "added": s.added_time,
            "completed": s.completed_time,
            "position": s.queue_position,
            "progress": s.progress,
            "size": s.total_wanted,
            "size_downloaded": s.total_wanted_done,
            "download_rate": s.download_rate,
            "upload_rate": s.upload_rate,
            "size_uploaded": s.all_time_upload,
            "state": gen_state(self.handle, s.state),
            "seeds": s.num_seeds,
            "peers": s.num_peers,
            "full_copy": s.distributed_full_copies,
            "seed_rank": s.seed_rank,
            "current_tracker": s.current_tracker,
            "save_path": s.save_path,
            "files": ret_files,
        }
    
    def set_data(self, data):
        self.data = base64.b64encode(lt.bencode(data)).decode()
    
    def set_priority(self, id, priority):
        self.handle.file_priority(id, priority)
    
    def set_trigger(self, data):
        self.triggers.add(data)
    
    def update_trigger(self, id, state):
       self.triggers.update(id, state)
    
    def pause(self, paused=True):
        if paused:
           self.handle.pause()
        else:
           self.handle.resume()
    
    def set_position(self, position):
        if position == "top":
            self.handle.queue_position_top()
        elif position == "bottom":
            self.handle.queue_position_bottom()
        elif position == "up":
            self.handle.queue_position_up()
        elif position == "down":
            self.handle.queue_position_down()
    
    def delete_files(self):
        parts_path = os.path.join(self.handle.save_path(),"."+self.hash+".parts");
        if os.path.exists(parts_path):
            os.remove(parts_path)
        if os.path.isfile(self.path):
            os.remove(self.path)
        elif os.path.isdir(self.path):
            shutil.rmtree(self.path)
        else:
            pass
    
    def alert_save(self):
        self.handle.save_resume_data(lt.save_resume_flags_t.flush_disk_cache | lt.save_resume_flags_t.save_info_dict)

def gen_state(h, state):
    state_str = ['queued', 'checking', 'downloading metadata',
                 'downloading', 'finished', 'seeding', 'allocating',
                 'checking fastresume']
    if h.is_paused():
        return "paused"
    return state_str[state]
