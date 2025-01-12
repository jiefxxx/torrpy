import base64
import json
import os
import queue
import threading
import time
import libtorrent as lt

from torrent.torrent import Torrent

from torrent.exception import TriggerDataException,NoSpaceLeftException


class Manager:
    def __init__(self, download_path, callback=None) -> None:
        self.ses = lt.session()
        settings = lt.default_settings()
        settings["alert_mask"] = settings["alert_mask"] | lt.alert.category_t.status_notification | lt.alert.category_t.progress_notification
        settings["listen_interfaces"] = "0.0.0.0:5550,[::]:5550"
        settings["upload_rate_limit"] = 0
        settings["download_rate_limit"] = 0

        self.ses.apply_settings(settings)

        self.download_path = download_path
        self.fast_resume_path = os.path.join(download_path, ".fast_resume.json")
        self.callback = callback

        self.torrents = []

        if self.callback is not None:
            self.callback_queue = queue.Queue()

            self.callback_thread = threading.Thread(target=self._callback_handler)
            self.callback_thread.start()
        
        self.run = True
        self.alert_thread = threading.Thread(target=self._alert_handler)
        self.alert_thread.start()

        self.next = time.time()+(60*60)

        for info in load_fast_resume_json(self.fast_resume_path):
            h = self.ses.add_torrent({'resume_data': base64.b64decode(info["data"]),
                                      'save_path': info["save_path"]})
            if h.is_valid():
                torrent = Torrent(h, data=info['data'], triggers=info["triggers"])
                self.torrents.append(torrent)
            else:
                print(f"error add torrent for fast_resume info {info}")
        
        self._execute_triggers()
    
    def close(self):
        print("closing alert thread")
        self.run = False
        self.alert_thread.join()
        if self.callback:
            print("closing callback thread")
            self.callback_queue.put(None)
            self.callback_thread.join()
        


    def get(self, hash):
        for torrent in self.torrents:
            if hash == torrent.hash:
                return torrent
    
    def add_torrent(self, path):
        info = lt.torrent_info(path)
        torrent = None
        try:
            h = self.ses.add_torrent({'ti': info,
                                      'save_path': self.download_path,
                                      'storage_mode': lt.storage_mode_t(2)})

            if h.is_valid():
                torrent = Torrent(h)
                self.torrents.append(torrent)
                torrent.alert_save()

        except RuntimeError:
            torrent = self.get(str(info.info_hash()))
        
        finally:
            return torrent.full_info()
        
    def info(self, hash=None):
        if hash is not None:
            torrent = self.get(hash)
            if torrent is not None:
                return torrent.full_info()
            else:
                return None
        info = {
            "torrents":[],
        }
        for torrent in self.torrents:
            info["torrents"].append(torrent.info())
        return info
    
    def pause(self, hash=None, pause=True):
        if hash is not None:
            self.get(hash).pause(pause)
        else:
            for torrent in self.torrents:
                torrent.pause(pause)
    
    def remove(self, hash, files=True):
        torrent = self.get(hash)
        self.torrents.remove(torrent)

        self.ses.remove_torrent(torrent.handle)

        if files:
            torrent.delete_files()

        if len(self.torrents)> 0:
            self.alert_save()
        else:
            self._save()
    
    def set_trigger(self, hash, data):
        torrent = self.get(hash)
        torrent.set_trigger(data)
        torrent.alert_save()
        if torrent.completed():                    #todo files completed instead of torrent completed
            self._execute_trigger(hash, data["id"])
    
    def set_position(self, hash, position):
        self.get(hash).set_position(position)
    
    def set_priority(self, hash, id, priority):
        self.get(hash).set_priority(id, priority)

    def alert_save(self, hash=None):
        if hash is not None:
            self.get(hash).alert_save()
        else:
            for torrent in self.torrents:
                torrent.alert_save()

    def _save(self):
        fast_resume = []
        for torrent in self.torrents:
            fast_resume.append(torrent.fast_resume())
        
        write_fast_resume_json(fast_resume, self.fast_resume_path)
    
    def _execute_triggers(self, hash=None):
        if hash:
            torrent = self.get(hash)
            if torrent is not None and torrent.completed():
                for id in torrent.trigger_ids():
                        self._execute_trigger(hash, id)
        else:
            for torrent in self.torrents:
                if torrent is not None and torrent.completed():
                    for id in torrent.trigger_ids():
                        self._execute_trigger(torrent.hash, id)
    
    def _execute_trigger(self, hash, id):
        torrent = self.get(hash)
        trigger = torrent.trigger(id)
        if trigger is not None and trigger["state"]==0:
            if self.callback is None:
                 torrent.update_trigger(id, -1)
                 return
            torrent.update_trigger(id, 1)
            self.callback_queue.put((torrent.hash, id, trigger["data"]))

    def _alert_handler(self):
        while True:
            if self.ses.wait_for_alert(1000):
                need_save = False
                for a in self.ses.pop_alerts():
                    #print(f"libtorrent::{a}")
                    if type(a) == lt.save_resume_data_alert:
                        self.get(str(a.handle.info_hash())).set_data(a.resume_data)
                        need_save = True

                    elif type(a) == lt.torrent_finished_alert:
                        hash = str(a.handle.info_hash())
                        self._execute_triggers(hash)
                        torrent = self.get(hash)
                        if torrent is not None:
                            torrent.alert_save()

                    elif type(a) == lt.file_completed_alert:
                        self._execute_trigger(str(a.handle.info_hash()), a.index)

                if need_save:
                    self._save()

            elif not self.run:
                return
            
            elif time.time()>self.next:
                self.next += 60*60
                self.alert_save()
    
    def _callback_handler(self):
        while True:
            element = self.callback_queue.get()
            if element is None:
                return
            
            hash, id, data = element

            torrent = self.get(hash)
            path = torrent.file_path(id)
            if torrent is not None:
                torrent.update_trigger(id, 2)
                try:
                    self.callback(path, data)
                    torrent.update_trigger(id, 3)
                except NoSpaceLeftException:
                    torrent.update_trigger(id, -2)
                except TriggerDataException as e:
                    torrent.update_trigger(id, -3)
                    print(e)
                except Exception as e:
                    torrent.update_trigger(id, -4)
                    print(e)
                finally:
                    torrent.alert_save()


def load_fast_resume_json(path):
    try:
        with open(path, "r") as f:
            return json.load(f)
    except (json.decoder.JSONDecodeError, FileNotFoundError):
        print(f"error while charging fast resume {path}")
        return []

def write_fast_resume_json(fast_resume, path):
     with open(path, "w") as f:
            json.dump(fast_resume, f)

    





        

    

    

        
