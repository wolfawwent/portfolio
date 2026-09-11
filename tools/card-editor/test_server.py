"""Run: python -m unittest discover -s tools/card-editor -p test_server.py"""
import base64
import importlib.util
import json
from pathlib import Path
import struct
import tempfile
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import zlib

spec=importlib.util.spec_from_file_location('card_server',Path(__file__).with_name('server.py'))
app=importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)

def glb():
    data=json.dumps({'asset':{'version':'2.0'},'animations':[{'name':'idle'}]}).encode()
    data+=b' '*((-len(data))%4)
    return struct.pack('<5I',0x46546c67,2,len(data)+20,len(data),0x4e4f534a)+data

def png():
    def chunk(kind,data):
        return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data))
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1000,1400,8,6,0,0,0))+chunk(b'IDAT',zlib.compress((b'\0'+b'\0'*4000)*1400))+chunk(b'IEND',b'')

class SecurityAndPersistence(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        app.ROOT=Path(self.temp.name)
        app.LOCAL=app.ROOT/'private'
        app.MANIFEST=app.ROOT/'assets/cards/manifest.json'
        self.server=app.ThreadingHTTPServer(('127.0.0.1',0),app.Handler)
        self.server.authority='127.0.0.1:'+str(self.server.server_port)
        self.server.origin='http://'+self.server.authority
        self.server.token='test-login'
        self.server.session='test-session'
        threading.Thread(target=self.server.serve_forever,daemon=True).start()
        self.payload={'name':'風之使者 Kazek','model':base64.b64encode(glb()).decode(),'png':base64.b64encode(png()).decode(),'config':{'x':2,'y':-1,'scale':1.2,'yaw':180,'pitch':5,'roll':12,'animationIndex':0,'time':1.2,'playing':False}}

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.temp.cleanup()

    def request(self,path,body=None,auth=True,origin=True,host=None):
        headers={}
        if auth:headers['Cookie']='card_editor_session=test-session'
        if origin:headers['Origin']=self.server.origin
        if host:headers['Host']=host
        if body is not None:headers['Content-Type']='application/json'
        req=Request(self.server.origin+path,data=json.dumps(body).encode() if body is not None else None,headers=headers)
        try:
            with urlopen(req) as r:return r.status,r.read()
        except HTTPError as e:return e.code,e.read()

    def test_management_and_write_require_session(self):
        for path in ['/__editor/','/__editor/editor.js','/__editor/api/cards','/__editor/api/session']:
            self.assertEqual(self.request(path,auth=False)[0],403)
        self.assertEqual(self.request('/__editor/api/save',self.payload,auth=False)[0],403)
        self.assertFalse(app.MANIFEST.exists())

    def test_origin_and_host_are_enforced(self):
        self.assertEqual(self.request('/__editor/api/save',self.payload,origin=False)[0],403)
        self.assertEqual(self.request('/__editor/api/save',self.payload,host='evil.example')[0],403)
        self.assertFalse(app.MANIFEST.exists())

    def test_private_files_and_traversal_are_not_served(self):
        for path in ['/tools/card-editor/.local/runtime.json','/.git/config','/assets/../../server.py','/__editor/../server.py']:
            self.assertEqual(self.request(path)[0],404)

    def test_save_update_preserves_model_and_settings(self):
        code,body=self.request('/__editor/api/save',self.payload)
        self.assertEqual(code,200,body)
        first=json.loads(body)
        self.assertEqual((app.ROOT/first['model']).read_bytes(),glb())
        self.assertEqual(first['config'],self.payload['config'])
        self.payload.update(id=first['id'],name='更新後的名稱')
        code,body=self.request('/__editor/api/save',self.payload)
        self.assertEqual(code,200,body)
        second=json.loads(body)
        self.assertEqual(second['id'],first['id'])
        self.assertNotEqual(second['model'],first['model'])
        self.assertTrue((app.ROOT/first['model']).exists())
        self.assertEqual(len(app.records()),1)
        self.assertEqual(app.records()[0]['name'],'更新後的名稱')
        self.assertTrue(list(app.LOCAL.glob('manifest-*.json')))

    def test_invalid_inputs_never_change_manifest(self):
        for field,value in [('id','../../escape'),('name','字'*41),('model','broken'),('png','broken'),('config',{'x':float('nan')})]:
            payload={**self.payload,field:value}
            self.assertEqual(self.request('/__editor/api/save',payload)[0],400)
            self.assertFalse(app.MANIFEST.exists())

if __name__=='__main__':unittest.main()
