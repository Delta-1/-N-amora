import subprocess,time,xml.etree.ElementTree as ET

def shell(*args):
 return subprocess.run(['adb','shell',*args],capture_output=True,text=True,check=True).stdout

def wait_ui(predicate,label):
 for attempt in range(15):
  time.sleep(2)
  subprocess.run(['adb','shell','uiautomator','dump','/sdcard/amora.xml'],capture_output=True)
  result=subprocess.run(['adb','shell','cat','/sdcard/amora.xml'],capture_output=True,text=True).stdout
  if predicate(result):
   print('PASS:',label)
   return result
 logs=subprocess.run(['adb','logcat','-d','-t','300'],capture_output=True,text=True).stdout
 print(logs)
 raise SystemExit(label+' failed')

wait_ui(lambda x:'Criar conta' in x and ('E-mail' in x or 'Senha' in x),'APK renders account onboarding')
# A clean emulator grants overlay consent for the native service test.
shell('appops','set','com.amora.app','SYSTEM_ALERT_WINDOW','allow')
shell('am','start','-W','-n','com.amora.app/.MainActivity','-a','amora.overlay')
shell('input','keyevent','KEYCODE_HOME')
xml=wait_ui(lambda x:'content-desc="Abrir Lilith"' in x,'native Lilith bubble stays above the Android home screen')
root=ET.fromstring(xml)
node=next(n for n in root.iter('node') if n.get('content-desc')=='Abrir Lilith')
import re
x1,y1,x2,y2=map(int,re.findall(r'\d+',node.get('bounds')))
shell('input','tap',str((x1+x2)//2),str((y1+y2)//2))
wait_ui(lambda x:'Abrir Amora' in x and 'Recolher' in x,'bubble opens the floating Lilith panel')
with open('android-smoke.png','wb') as f:
 subprocess.run(['adb','exec-out','screencap','-p'],stdout=f,check=True)
