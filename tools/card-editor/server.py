"""Loopback-only card editor; no third-party Python dependencies."""
import argparse
import base64
import binascii
import json
import math
import mimetypes
import os
from pathlib import Path
import secrets
import shutil
import struct
import threading
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, parse_qs, unquote
import uuid
import webbrowser

ROOT = Path(__file__).resolve().parents[2]
UI = Path(__file__).resolve().parent
LOCAL = UI / '.local'
MANIFEST = ROOT / 'assets/cards/manifest.json'
MAX_GLB = 64 * 1024 * 1024
MAX_BODY = 102 * 1024 * 1024
LOCK = threading.Lock()

def check_glb(data):
    if not 20 <= len(data) <= MAX_GLB:
        raise ValueError('GLB 大小必須介於 20 bytes 與 64 MB 之間。')
    magic, version, length, chunk_length, chunk_type = struct.unpack_from('<5I', data)
    if (magic, version, length, chunk_type) != (0x46546C67, 2, len(data), 0x4E4F534A) or chunk_length > len(data)-20:
        raise ValueError('無效的 GLB 2.0 檔案。')
    try:
        doc = json.loads(data[20:20+chunk_length].decode('utf-8'))
        if not isinstance(doc, dict):
            raise ValueError()
        for entry in doc.get('buffers', []) + doc.get('images', []):
            uri = entry.get('uri')
            if uri and (not isinstance(uri, str) or not uri.startswith('data:')):
                raise ValueError('請使用內嵌貼圖的 GLB。')
    except (UnicodeError, TypeError, AttributeError, json.JSONDecodeError) as exc:
        raise ValueError('無效的 GLB JSON。') from exc
    return doc

def validate_config(raw, animation_count):
    if not isinstance(raw, dict):
        raise ValueError('缺少卡片設定。')
    limits = {'x':(-12,12), 'y':(-12,12), 'z':(-30,30), 'scale':(.25,2.5), 'yaw':(-180,180), 'pitch':(-60,60), 'roll':(-45,45), 'time':(0,86400)}
    result = {}
    for key, (low, high) in limits.items():
        value = raw.get(key, 0) if key == 'z' else raw.get(key)
        if isinstance(value, bool) or not isinstance(value, (int,float)) or not math.isfinite(value) or not low <= value <= high:
            raise ValueError('卡片設定超出範圍：' + key)
        result[key] = value
    index = raw.get('animationIndex')
    if type(index) is not int or not -1 <= index < animation_count:
        raise ValueError('無效的動畫選項。')
    if type(raw.get('playing')) is not bool:
        raise ValueError('無效的播放設定。')
    result.update(animationIndex=index, playing=raw['playing'])
    return result

def records():
    if not MANIFEST.exists():
        return []
    data = json.loads(MANIFEST.read_text(encoding='utf-8'))
    if not isinstance(data, list):
        raise ValueError('作品清單格式錯誤，請先還原備份。')
    return data

def save_card(payload):
    if not isinstance(payload, dict):
        raise ValueError('無效的請求內容。')
    name = payload.get('name')
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > 40 or any(ord(c)<32 or ord(c)==127 for c in name):
        raise ValueError('名稱必須為 1 至 40 個字，且不得包含控制字元。')
    try:
        model = base64.b64decode(payload.get('model',''), validate=True)
        png = base64.b64decode(payload.get('png',''), validate=True)
    except (ValueError, TypeError, binascii.Error) as exc:
        raise ValueError('檔案資料編碼錯誤。') from exc
    doc = check_glb(model)
    if not 24 <= len(png) <= 12*1024*1024 or png[:8] != b'\x89PNG\r\n\x1a\n' or png[12:16] != b'IHDR' or struct.unpack('>II',png[16:24]) != (1000,1400):
        raise ValueError('卡片縮圖必須是 1000 × 1400 的 PNG。')
    config = validate_config(payload.get('config'), len(doc.get('animations',[])))
    card_id = payload.get('id')
    if card_id is not None:
        try:
            if str(uuid.UUID(card_id)) != card_id:
                raise ValueError()
        except (ValueError, TypeError, AttributeError) as exc:
            raise ValueError('無效的卡片識別碼。') from exc
    with LOCK:
        items = records()
        if card_id is not None and not any(c.get('id')==card_id for c in items):
            raise ValueError('找不到要更新的卡片。')
        card_id = card_id or str(uuid.uuid4())
        revision = uuid.uuid4().hex
        model_path = ROOT / f'assets/models/{card_id}-{revision}.glb'
        image_path = ROOT / f'assets/cards/{card_id}-{revision}.png'
        record = {'id':card_id,'name':name.strip(),'model':model_path.relative_to(ROOT).as_posix(),'image':image_path.relative_to(ROOT).as_posix(),'config':config}
        next_items = [record if c.get('id')==card_id else c for c in items]
        if not any(c.get('id')==card_id for c in items):
            next_items.append(record)
        MANIFEST.parent.mkdir(parents=True,exist_ok=True)
        model_path.parent.mkdir(parents=True,exist_ok=True)
        temp = MANIFEST.with_name('manifest.'+revision+'.tmp')
        try:
            model_path.write_bytes(model)
            image_path.write_bytes(png)
            temp.write_text(json.dumps(next_items,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
            if MANIFEST.exists():
                LOCAL.mkdir(parents=True,exist_ok=True)
                shutil.copyfile(MANIFEST,LOCAL/f'manifest-{revision}.json')
            os.replace(temp,MANIFEST)
        except Exception:
            for file in (model_path,image_path,temp):
                file.unlink(missing_ok=True)
            raise
    return record

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # Never log login tokens or uploaded content.

    def send(self, code, body, content_type='application/json; charset=utf-8', headers=None):
        if isinstance(body,(dict,list)):
            body=json.dumps(body,ensure_ascii=False).encode('utf-8')
        elif isinstance(body,str):
            body=body.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type',content_type)
        self.send_header('Content-Length',str(len(body)))
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Referrer-Policy','no-referrer')
        self.send_header('X-Frame-Options','DENY')
        for key,value in (headers or {}).items():
            self.send_header(key,value)
        self.end_headers()
        if self.command!='HEAD':
            self.wfile.write(body)

    def trusted_host(self):
        return self.client_address[0]=='127.0.0.1' and self.headers.get('Host')==self.server.authority

    def authenticated(self):
        try:
            cookie=SimpleCookie(self.headers.get('Cookie',''))
            value=cookie.get('card_editor_session')
            return value is not None and secrets.compare_digest(value.value,self.server.session)
        except Exception:
            return False

    def do_GET(self):
        if not self.trusted_host():
            return self.send(403,{'error':'僅允許本機存取。'})
        url=urlsplit(self.path)
        if url.path=='/__editor/login':
            token=parse_qs(url.query).get('token',[''])[0]
            if not secrets.compare_digest(token,self.server.token):
                return self.send(403,{'error':'請由本機啟動器開啟工作台。'})
            return self.send(303,b'',headers={'Location':'/__editor/','Set-Cookie':f'card_editor_session={self.server.session}; HttpOnly; SameSite=Strict; Path=/'})
        if url.path.startswith('/__editor'):
            if not self.authenticated():
                return self.send(403,{'error':'請執行「啟動卡片工具.ps1」，由專用連結開啟。'})
            if url.path=='/__editor/api/session':
                return self.send(200,{'owner':True,'modelDepth':True})
            if url.path=='/__editor/api/cards':
                try:
                    return self.send(200,records())
                except (ValueError,OSError) as exc:
                    return self.send(500,{'error':str(exc)})
            files={'/__editor/':'editor.html','/__editor/editor.css':'editor.css','/__editor/editor.js':'editor.js','/__editor/card-renderer.js':'card-renderer.js'}
            if url.path in files:
                return self.serve_file(UI/files[url.path])
            return self.send(404,{'error':'找不到頁面。'})
        path=unquote(url.path).lstrip('/') or 'index.html'
        allowed=path=='index.html' or path.startswith(('assets/','css/','js/'))
        resolved=(ROOT/path).resolve()
        if not allowed or not resolved.is_relative_to(ROOT) or any(p.startswith('.') for p in Path(path).parts):
            return self.send(404,{'error':'找不到檔案。'})
        return self.serve_file(resolved)

    def serve_file(self,path):
        if not path.is_file():
            return self.send(404,{'error':'找不到檔案。'})
        content_type={'.js':'text/javascript; charset=utf-8','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.glb':'model/gltf-binary','.otf':'font/otf'}.get(path.suffix,mimetypes.guess_type(path.name)[0] or 'application/octet-stream')
        return self.send(200,path.read_bytes(),content_type)

    def do_POST(self):
        if not self.trusted_host() or not self.authenticated() or self.headers.get('Origin')!=self.server.origin:
            return self.send(403,{'error':'未授權的編輯請求。'})
        if urlsplit(self.path).path!='/__editor/api/save':
            return self.send(404,{'error':'找不到操作。'})
        if self.headers.get_content_type()!='application/json':
            return self.send(415,{'error':'需要 JSON 格式。'})
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=MAX_BODY:
                return self.send(413,{'error':'上傳資料超過大小限制。'})
            self.connection.settimeout(60)
            raw=self.rfile.read(size)
            if len(raw)!=size:
                raise ValueError('上傳尚未完成。')
            record=save_card(json.loads(raw))
            return self.send(200,record)
        except (ValueError,TypeError,UnicodeError) as exc:
            return self.send(400,{'error':str(exc)})
        except OSError:
            return self.send(500,{'error':'無法寫入網站資料夾；原作品清單未變更。'})

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--port',type=int,default=0)
    parser.add_argument('--no-browser',action='store_true')
    args=parser.parse_args()
    server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
    server.authority=f'127.0.0.1:{server.server_port}'
    server.origin='http://'+server.authority
    server.token=secrets.token_urlsafe(32)
    server.session=secrets.token_urlsafe(32)
    login=server.origin+'/__editor/login?token='+server.token
    LOCAL.mkdir(parents=True,exist_ok=True)
    runtime=LOCAL/'runtime.json'
    runtime.write_text(json.dumps({'url':server.origin,'loginUrl':login,'pid':os.getpid()}),encoding='utf-8')
    print('Card editor running at '+server.origin,flush=True)
    print('Only this computer can connect. Ctrl+C to stop.',flush=True)
    if not args.no_browser:
        webbrowser.open(login)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        try:
            if json.loads(runtime.read_text()).get('pid')==os.getpid():
                runtime.unlink()
        except (OSError,ValueError):
            pass

if __name__=='__main__':
    main()
